function showGameResultModal() {
    const modal = document.getElementById("gameResultModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function closeModal() {
    const modal = document.getElementById("gameResultModal");
    if (modal) modal.style.display = "none";
}

window.showGameResultModal = showGameResultModal;

document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("closeModalBtn");
    const playAgainBtn = document.getElementById("playAgainBtn");

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (playAgainBtn) playAgainBtn.addEventListener("click", () => location.reload());

    const storedScore = localStorage.getItem("showWinModal");
    if (storedScore) {
        showGameResultModal();
        localStorage.removeItem("showWinModal");
    }
});