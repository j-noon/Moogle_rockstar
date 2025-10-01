document.addEventListener("DOMContentLoaded", function () {
  const buttons = document.querySelectorAll(".dropbtn");

  buttons.forEach(button => {
    button.addEventListener("click", function (e) {
      e.stopPropagation();

      const dropdown = this.nextElementSibling;

      // Close other dropdowns first
      document.querySelectorAll(".dropdown-content").forEach(dc => {
        if (dc !== dropdown) dc.style.display = "none";
      });

      // Toggle current dropdown
      dropdown.style.display = (dropdown.style.display === "block") ? "none" : "block";
    });
  });

  window.addEventListener("click", function (e) {
    if (!e.target.matches('.dropbtn')) {
      document.querySelectorAll(".dropdown-content").forEach(dc => {
        dc.style.display = "none";
      });
    }
  });
});
