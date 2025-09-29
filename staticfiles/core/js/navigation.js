document.addEventListener("DOMContentLoaded", function () {
    const navBtn = document.getElementById('nav-btn');
    const navList = document.getElementById('nav-list');

    if (navBtn && navList) {
        navBtn.addEventListener('click', () => {
            navList.classList.toggle('show');
        });
    }
});