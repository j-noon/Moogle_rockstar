document.addEventListener("DOMContentLoaded", function () {
    const aboutBtn = document.getElementById('about-btn');
    const aboutPara = document.getElementById('about-para');

    if (aboutBtn && aboutPara) {
        aboutBtn.addEventListener('click', function() {
            aboutPara.classList.toggle('show');
        });
    }
});