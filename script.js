// Load schools data
let schoolsData = [];
let filteredSchools = [];
let selectedSchools = new Set();
let allStreetNames = new Set();
let filteredStreets = [];
let currentHighlightedIndex = -1;

// Precomputed normalized search indices for fast searching
let schoolSearchIndex = [];
let streetSearchIndex = [];

// Icons for different genders
const genderIcons = {
    'دخترانه': '👧',
    'پسرانه': '👦'
};

/**
 * Comprehensive text normalization for Persian/Farsi search
 * Handles:
 * - Persian digits (۰-۹) -> English (0-9)
 * - Arabic digits (٠-٩) -> English (0-9)
 * - Arabic/Persian character variations
 * - Spaces and نیم‌فاصله (half-space / ZWSP)
 * - Diacritics
 */
function normalizeText(text) {
    if (!text) return '';
    
    // Convert to string if needed
    text = String(text);
    
    // 1. Remove all types of spaces and ZWSP (نیم‌فاصله / U+200B)
    text = text.replace(/[\s\u200B\u200C\u200D]/g, '');
    
    // 2. Convert Persian digits (۰-۹) to English (0-9)
    text = text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    
    // 3. Convert Arabic digits (٠-٩) to English (0-9)
    text = text.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    
    // 4. Normalize Arabic/Persian character variations
    // ی and ي (different forms of ya)
    text = text.replace(/[يي]/g, 'ی');
    
    // ه and ۀ and ة (different forms of ha)
    text = text.replace(/[ہۀة]/g, 'ه');
    
    // ك and ک (different forms of kaf)
    text = text.replace(/[كك]/g, 'ک');
    
    // Remove diacritics (اعراب)
    // Fatha, Damma, Kasra, Shadda, Sukun, Tanwin, Madda
    text = text.replace(/[\u064B-\u0652]/g, '');
    
    // ل + ا = لا (Lam + Alef ligature)
    text = text.replace(/لا/g, 'لا');
    
    return text.trim().toLowerCase();
}

/**
 * Build search index for faster searching
 * Creates normalized versions of all searchable text
 */
function buildSearchIndex() {
    schoolSearchIndex = schoolsData.map(school => ({
        original: school,
        name: normalizeText(school.name),
        address: normalizeText(school.address),
        gender: normalizeText(school.gender),
        period: normalizeText(school.period),
        streets: (school.streets || [])
            .map(s => normalizeText(s))
            .filter(s => s.length > 0),
        neighbors: (school.neighbors || [])
            .map(n => normalizeText(n))
            .filter(n => n.length > 0)
    }));

    streetSearchIndex = Array.from(allStreetNames).map(street => ({
        original: street,
        normalized: normalizeText(street)
    }));
}

/**
 * Advanced search algorithm with multiple ranking factors
 * Returns results sorted by relevance
 */
function advancedSearch(query) {
    if (!query || query.length === 0) {
        return [];
    }

    const normalizedQuery = normalizeText(query);

    // Rank schools by relevance
    const rankedResults = schoolSearchIndex
        .map((schoolIndex, originalIndex) => {
            let score = 0;
            let matchType = null;

            // 1. Exact match in name (highest priority)
            if (schoolIndex.name === normalizedQuery) {
                score = 10000;
                matchType = 'exactName';
            }
            // 2. Name starts with query (very high priority)
            else if (schoolIndex.name.startsWith(normalizedQuery)) {
                score = 5000;
                matchType = 'nameStarts';
            }
            // 3. Name contains query
            else if (schoolIndex.name.includes(normalizedQuery)) {
                score = 4000;
                matchType = 'nameContains';
            }
            // 4. Any street starts with query
            else if (schoolIndex.streets.some(s => s.startsWith(normalizedQuery))) {
                score = 2500;
                matchType = 'streetStarts';
            }
            // 5. Any street contains query
            else if (schoolIndex.streets.some(s => s.includes(normalizedQuery))) {
                score = 1500;
                matchType = 'streetContains';
            }
            // 6. Address contains query
            else if (schoolIndex.address.includes(normalizedQuery)) {
                score = 800;
                matchType = 'addressContains';
            }
            // 7. Any neighbor starts with query
            else if (schoolIndex.neighbors.some(n => n.startsWith(normalizedQuery))) {
                score = 300;
                matchType = 'neighborStarts';
            }

            return {
                originalIndex,
                school: schoolIndex.original,
                score,
                matchType
            };
        })
        .filter(result => result.score > 0)
        .sort((a, b) => {
            // Primary sort by score
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            // Secondary sort by school name alphabetically
            return a.school.name.localeCompare(b.school.name, 'fa');
        });

    return rankedResults.map(r => r.school);
}

/**
 * Fast street search with Levenshtein distance for typo tolerance
 */
function searchStreets(query, maxResults = 15) {
    if (!query || query.length < 1) {
        return [];
    }

    const normalizedQuery = normalizeText(query);

    // First pass: exact matches and prefix matches
    const exactMatches = [];
    const prefixMatches = [];
    const containsMatches = [];

    streetSearchIndex.forEach(streetIndex => {
        const normalized = streetIndex.normalized;

        if (normalized === normalizedQuery) {
            exactMatches.push(streetIndex);
        } else if (normalized.startsWith(normalizedQuery)) {
            prefixMatches.push(streetIndex);
        } else if (normalized.includes(normalizedQuery)) {
            containsMatches.push(streetIndex);
        }
    });

    // Combine with priority order
    const results = [
        ...exactMatches,
        ...prefixMatches,
        ...containsMatches
    ]
        .slice(0, maxResults)
        .map(si => si.original);

    return results;
}

/**
 * Calculate Levenshtein distance for typo tolerance
 */
function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadSchools();
    setupEventListeners();
});

// Load schools from JSON
async function loadSchools() {
    try {
        const response = await fetch('schools_structured.json');
        schoolsData = await response.json();
        extractAllStreetNames();
        buildSearchIndex();
        displayAllSchools();
        updateCounts();
    } catch (error) {
        console.error('Error loading schools:', error);
        const grid = document.getElementById('schoolsGrid');
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1;">
                <div class="no-results-icon">⚠️</div>
                خطا در بارگذاری اطلاعات مدارس
            </div>
        `;
    }
}

/**
 * Extract all unique street names from the JSON data
 */
function extractAllStreetNames() {
    allStreetNames.clear();
    
    schoolsData.forEach(school => {
        if (school.streets && Array.isArray(school.streets)) {
            school.streets.forEach(street => {
                if (street && street.length > 0) {
                    allStreetNames.add(street);
                }
            });
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    
    // Real-time search as user types
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            closeAutocomplete();
            performSearch();
        } else if (e.key === 'ArrowDown') {
            highlightNextSuggestion();
        } else if (e.key === 'ArrowUp') {
            highlightPreviousSuggestion();
        } else {
            updateAutocomplete();
        }
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-input-wrapper')) {
            closeAutocomplete();
        }
    });

    // Modal close button
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detailModal');
        if (e.target === modal) closeModal();
    });

    // Keyboard shortcut to close modal (Escape)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

/**
 * Update autocomplete suggestions based on input
 */
function updateAutocomplete() {
    const input = document.getElementById('searchInput');
    const searchTerm = input.value;

    if (!searchTerm || searchTerm.length < 1) {
        closeAutocomplete();
        return;
    }

    filteredStreets = searchStreets(searchTerm, 15);
    displayAutocomplete(filteredStreets, searchTerm);
    currentHighlightedIndex = -1;
}

/**
 * Display autocomplete dropdown with suggestions
 */
function displayAutocomplete(suggestions, searchTerm) {
    let dropdown = document.querySelector('.autocomplete-dropdown');
    
    if (!dropdown) {
        const wrapper = document.querySelector('.search-input-wrapper');
        dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        wrapper.appendChild(dropdown);
    }

    if (suggestions.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-no-results">تطابقی یافت نشد</div>';
        dropdown.classList.add('show');
        return;
    }

    const normalizedSearch = normalizeText(searchTerm);

    dropdown.innerHTML = suggestions.map((street, index) => {
        // Highlight the matching part (using original search term)
        const displayText = street.replace(
            new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<span class="autocomplete-item-highlight">$1</span>'
        );

        return `
            <div class="autocomplete-item" onclick="selectSuggestion('${street.replace(/'/g, "\\'")}', event)" data-index="${index}">
                🛣️ ${displayText}
            </div>
        `;
    }).join('');

    dropdown.classList.add('show');
}

/**
 * Close autocomplete dropdown
 */
function closeAutocomplete() {
    const dropdown = document.querySelector('.autocomplete-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    currentHighlightedIndex = -1;
}

/**
 * Select a suggestion from the dropdown
 */
function selectSuggestion(street, event) {
    event.stopPropagation();
    document.getElementById('searchInput').value = street;
    closeAutocomplete();
    performSearch();
}

/**
 * Highlight next suggestion with arrow key
 */
function highlightNextSuggestion() {
    const items = document.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    if (currentHighlightedIndex < items.length - 1) {
        currentHighlightedIndex++;
    } else {
        currentHighlightedIndex = 0;
    }

    updateHighlight(items);
}

/**
 * Highlight previous suggestion with arrow key
 */
function highlightPreviousSuggestion() {
    const items = document.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    if (currentHighlightedIndex > 0) {
        currentHighlightedIndex--;
    } else {
        currentHighlightedIndex = items.length - 1;
    }

    updateHighlight(items);
}

/**
 * Update visual highlight and select with enter key
 */
function updateHighlight(items) {
    items.forEach((item, index) => {
        if (index === currentHighlightedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
            
            // Allow Enter key to select
            document.addEventListener('keydown', function handleEnter(e) {
                if (e.key === 'Enter' && currentHighlightedIndex === index) {
                    item.click();
                    document.removeEventListener('keydown', handleEnter);
                }
            });
        } else {
            item.classList.remove('selected');
        }
    });
}

/**
 * High-performance search using advanced algorithm
 */
function performSearch() {
    const searchTerm = document.getElementById('searchInput').value;
    const genderFilter = document.getElementById('genderFilter').value;
    const periodFilter = document.getElementById('periodFilter').value;

    // Use advanced search algorithm
    let results = advancedSearch(searchTerm);

    // Apply additional filters
    if (genderFilter || periodFilter) {
        results = results.filter(school => {
            const matchesGender = !genderFilter || school.gender === genderFilter;
            const matchesPeriod = !periodFilter || school.period.includes(periodFilter);
            return matchesGender && matchesPeriod;
        });
    }

    filteredSchools = results;
    displaySchools(filteredSchools);
    updateCounts();
}

// Reset all filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('genderFilter').value = '';
    document.getElementById('periodFilter').value = '';
    selectedSchools.clear();
    closeAutocomplete();
    displayAllSchools();
    updateCounts();
}

// Display all schools
function displayAllSchools() {
    filteredSchools = [...schoolsData];
    displaySchools(filteredSchools);
}

// Display schools in grid
function displaySchools(schools) {
    const grid = document.getElementById('schoolsGrid');

    if (schools.length === 0) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1;">
                <div class="no-results-icon">🔍</div>
                متأسفانه مدرسه‌ای یافت نشد
                <p style="margin-top: 10px; font-size: 0.9em; opacity: 0.8;">
                    لطفا فیلترها را مجدد بررسی کنید
                </p>
            </div>
        `;
        return;
    }

    grid.innerHTML = schools.map((school) => {
        const realIndex = schoolsData.indexOf(school);
        const genderIcon = genderIcons[school.gender] || '🏫';
        
        return `
            <div class="school-card" onclick="showDetails(${realIndex})">
                <div class="school-icon">${genderIcon}</div>
                <h3>${school.name}</h3>
                <div class="school-info">
                    <div class="school-info-item">
                        <span class="school-info-label">📍 آدرس:</span>
                        <span class="school-info-value">${school.address}</span>
                    </div>
                    <div class="school-info-item">
                        <span class="school-info-label">📞 تلفن:</span>
                        <span class="school-info-value">${school.phone || '—'}</span>
                    </div>
                </div>
                <div class="badges-container">
                    <span class="badge gender-badge">${school.gender}</span>
                    <span class="badge period-badge">${school.period}</span>
                </div>
                <div class="neighbors-count">
                    🏢 ${school.neighbors.length} مدرسه مجاور
                </div>
                <button class="view-btn">مشاهده جزئیات ↓</button>
            </div>
        `;
    }).join('');
}

// Show school details in modal
function showDetails(index) {
    const school = schoolsData[index];
    selectedSchools.add(index);
    updateCounts();

    const modal = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');

    const neighborsHTML = school.neighbors.length > 0
        ? school.neighbors.map(n => `<span class="neighbor-tag">📚 ${n}</span>`).join('')
        : '<span style="color: #999;">اطلاعات درسترس نیست</span>';

    const streetsHTML = school.streets
        .filter(s => s && s.length > 0)
        .map(s => `<span class="street-tag">📍 ${s}</span>`)
        .join('');

    const genderIcon = genderIcons[school.gender] || '🏫';

    modalBody.innerHTML = `
        <div class="modal-header">
            <div class="modal-icon">${genderIcon}</div>
            <h2 class="modal-detail-title">${school.name}</h2>
        </div>

        <div class="modal-detail-item">
            <span class="modal-detail-item-label">📌 آدرس مدرسه</span>
            <span class="modal-detail-item-value">${school.address}</span>
        </div>

        <div class="modal-detail-item">
            <span class="modal-detail-item-label">👥 نوع مدرسه</span>
            <span class="modal-detail-item-value">${school.gender}</span>
        </div>

        <div class="modal-detail-item">
            <span class="modal-detail-item-label">📚 دوره تحصیلی</span>
            <span class="modal-detail-item-value">${school.period}</span>
        </div>

        <div class="modal-detail-item">
            <span class="modal-detail-item-label">📞 شماره تلفن</span>
            <span class="modal-detail-item-value">${school.phone || 'در دسترس نیست'}</span>
        </div>

        <div class="modal-detail-item">
            <span class="modal-detail-item-label">🏢 مدارس مجاور</span>
            <div class="neighbors-list">${neighborsHTML}</div>
        </div>

        ${streetsHTML ? `
        <div class="modal-detail-item">
            <span class="modal-detail-item-label">🛣️ خیابان‌های تحت پوشش</span>
            <div class="streets-list">${streetsHTML}</div>
        </div>
        ` : ''}
    `;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Update counts
function updateCounts() {
    document.getElementById('totalSchools').textContent = schoolsData.length;
    document.getElementById('foundSchools').textContent = filteredSchools.length || schoolsData.length;
    document.getElementById('selectedCount').textContent = selectedSchools.size;
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
});

// Smooth animations on page load
window.addEventListener('load', () => {
    const cards = document.querySelectorAll('.school-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
    });
});
