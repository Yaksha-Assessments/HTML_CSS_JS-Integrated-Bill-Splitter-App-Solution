(function initializeBillSplitter() {
  function getEl(id) {
    return typeof document !== "undefined" ? document.getElementById(id) : null;
  }

  function calculateBill() {
    const amountInput = getEl("amount");
    const tipInput = getEl("tip");
    const peopleSelect = getEl("people");
    const tipAmountSpan = getEl("tip-amount");
    const perPersonSpan = getEl("per-person");

    if (!amountInput || !tipInput || !peopleSelect || !tipAmountSpan || !perPersonSpan) return;

    const amount = parseFloat(amountInput.value) || 0;
    const tipPercent = parseFloat(tipInput.value) || 0;
    const people = parseInt(peopleSelect.value) || 1;

    const tipAmount = (amount * tipPercent) / 100;
    const total = amount + tipAmount;
    const perPerson = total / people;

    tipAmountSpan.textContent = `₹${tipAmount.toFixed(2)}`;
    perPersonSpan.textContent = `₹${perPerson.toFixed(2)}`;
  }

  function toggleTheme() {
    const toggleThemeBtn = getEl("toggle-theme");
    if (!toggleThemeBtn || typeof document === "undefined") return;

    document.body.classList.toggle("dark-mode");
    toggleThemeBtn.textContent = document.body.classList.contains("dark-mode") ? "Dark" : "Light";
  }

  function fillPeopleDropdown() {
    const peopleSelect = getEl("people");
    if (!peopleSelect || peopleSelect.options.length > 0) return;

    for (let i = 1; i <= 10; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = i;
      peopleSelect.appendChild(option);
    }
    peopleSelect.value = "2";
  }

  function setupEvents() {
    const calculateBtn = getEl("calculate");
    const toggleThemeBtn = getEl("toggle-theme");

    if (calculateBtn) {
      calculateBtn.addEventListener("click", calculateBill);
    }

    if (toggleThemeBtn) {
      toggleThemeBtn.addEventListener("click", toggleTheme);
    }
  }

  function init() {
    fillPeopleDropdown();
    setupEvents();
  }

  // Initialize in browser
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  // Expose for test cases (jsdom in Node)
  if (typeof window !== "undefined") {
    window.calculateBill = calculateBill;
    window.fillPeopleDropdown = fillPeopleDropdown;
    window.toggleTheme = toggleTheme;
  }
})();
