let schoolsData = [];

// بارگذاری داده‌های مدارس
async function loadSchools() {
  try {
    const response = await fetch('./data/schools.json');
    schoolsData = await response.json();
    console.log('مدارس بارگذاری شدند:', schoolsData);
  } catch (error) {
    console.error('خطا در بارگذاری مدارس:', error);
    alert('خطا در بارگذاری داده‌های مدارس');
  }
}

// جستجو بر اساس کوچه و شماره
function searchSchool() {
  const streetName = document.getElementById('street').value.trim();
  const streetNumber = parseInt(document.getElementById('number').value);
  const gender = document.getElementById('gender').value;
  const grade = document.getElementById('grade').value;

  // بررسی اینکه تمام فیلدها پر شده‌اند
  if (!streetName || !streetNumber) {
    alert('لطفاً نام کوچه و شماره کوچه را وارد کنید');
    return;
  }

  // جستجوی مدرسه
  const foundSchool = schoolsData.find(school => {
    return school.streets.some(street => {
      // تطابق نام کوچه
      if (street.name.includes(streetName) || streetName.includes(street.name)) {
        // اگر شماره خالی است (مثل بلوارها)
        if (street.numbers.length === 0) {
          return true;
        }
        // بررسی اینکه شماره در لیست باشد
        return street.numbers.includes(streetNumber);
      }
      return false;
    });
  });

  // نمایش نتایج
  const resultDiv = document.getElementById('result');
  if (foundSchool) {
    displayResult(foundSchool);
    resultDiv.style.display = 'block';
  } else {
    resultDiv.innerHTML = '<div style="background: #ff6b6b; color: white; padding: 20px; border-radius: 15px; text-align: center; font-size: 18px;">متأسفانه�� مدرسه‌ای برای این آدرس یافت نشد 😞</div>';
    resultDiv.style.display = 'block';
  }
}

// نمایش نتایج
function displayResult(school) {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `
    <div class="schoolTitle">${school.schoolName}</div>
    <div class="info">
      🏫 <strong>نوبت:</strong> ${school.shift}<br>
      📚 <strong>پایه‌های تحصیلی:</strong> ${school.grades.join(' - ')}<br>
      ☎ <strong>شماره تماس:</strong> ${school.phone}<br>
      📍 <strong>آدرس:</strong> ${school.address}
    </div>
  `;
}

// بارگذاری مدارس هنگام لود شدن صفحه
window.addEventListener('load', loadSchools);