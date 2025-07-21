document.addEventListener("DOMContentLoaded", function () {
    const navBtn = document.getElementById('nav-btn');
    const navList = document.getElementById('nav-list');
    const aboutBtn = document.getElementById('about-btn');
    const aboutPara = document.getElementById('about-para');


// click events for about me and nav button
    navBtn.addEventListener('click', () => {
        navList.classList.toggle('show');
    });

    aboutBtn.addEventListener('click', function(){
        aboutPara.classList.toggle('show');
    });




    
});