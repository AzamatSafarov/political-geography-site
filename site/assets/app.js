// Enhancements only. Every page reads and filters without this file.
(function () {
  "use strict";

  // Seminar format filter (CSS already gives the chips their look).
  var filter = document.querySelector(".filter");
  var grid = document.getElementById("seminar-grid");
  if (filter && grid) {
    var chips = Array.prototype.slice.call(filter.querySelectorAll(".chip"));
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
    var status = document.querySelector(".filter-status");
    var empty = document.querySelector(".filter-empty");
    var total = cards.length;

    var apply = function (key) {
      var shown = 0;
      cards.forEach(function (card) {
        var hit = key === "all" || card.getAttribute("data-format") === key;
        card.hidden = !hit;
        if (hit) shown++;
      });
      chips.forEach(function (chip) {
        var on = chip.getAttribute("data-filter") === key;
        chip.classList.toggle("is-on", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (status) {
        status.textContent = key === "all"
          ? "Показаны все " + total + " семинаров"
          : "Показано " + shown + " из " + total;
      }
      if (empty) empty.hidden = shown !== 0;
    };

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        apply(chip.getAttribute("data-filter"));
      });
    });
  }

  // Light the matching pin while a row of the atlas index is hovered.
  var pairs = document.querySelectorAll(".atlas-index a[data-pin]");
  Array.prototype.forEach.call(pairs, function (row) {
    var n = row.getAttribute("data-pin");
    var pin = document.querySelector('.pin[data-n="' + n + '"]');
    if (!pin) return;
    var lit = function () { pin.classList.add("is-lit"); };
    var dim = function () { pin.classList.remove("is-lit"); };
    row.addEventListener("mouseenter", lit);
    row.addEventListener("mouseleave", dim);
    row.addEventListener("focus", lit);
    row.addEventListener("blur", dim);
  });
})();
