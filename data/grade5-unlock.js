(function () {
  if (window.__passagePathGrade5UnlockApplied) return;
  window.__passagePathGrade5UnlockApplied = true;

  const gradeFiveText = /\b(?:g\s*5|grade\s*5|5th\s*grade)\b/i;
  const gradeFourText = /\b(?:g\s*4|grade\s*4|4th\s*grade)\b/i;
  const lockedText = /\b(?:coming\s+soon|soon|locked|unavailable)\b/i;
  const gradeControlSelector =
    "button, [role='button'], a, [data-grade], [data-action], [class*='grade'], [class*='card'], [class*='tile'], .choice-card, .track-card";
  const patchedObjects = new WeakSet();

  function textOf(node) {
    return (node && node.textContent ? node.textContent : "").replace(/\s+/g, " ");
  }

  function patchAvailabilityObject(value, depth) {
    if (!value || typeof value !== "object" || patchedObjects.has(value) || depth > 6) return;
    patchedObjects.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => patchAvailabilityObject(item, depth + 1));
      return;
    }

    const identityText = [value.grade, value.id, value.label, value.name, value.title, value.heading]
      .filter((part) => part !== undefined && part !== null)
      .join(" ");
    const looksLikeGradeFive = Number(value.grade) === 5 || gradeFiveText.test(identityText);

    if (looksLikeGradeFive) {
      if ("available" in value) value.available = true;
      if ("enabled" in value) value.enabled = true;
      if ("disabled" in value) value.disabled = false;
      if ("locked" in value) value.locked = false;
      if ("isLocked" in value) value.isLocked = false;
      if ("comingSoon" in value) value.comingSoon = false;

      ["status", "state", "availability"].forEach((key) => {
        if (typeof value[key] === "string" && lockedText.test(value[key])) value[key] = "available";
      });

      ["badge", "tag", "pill", "statusLabel"].forEach((key) => {
        if (typeof value[key] === "string" && lockedText.test(value[key])) value[key] = "Ready";
      });
    }

    Object.keys(value).forEach((key) => {
      if (["selections", "questions", "assessment_levels", "standardized_test"].includes(key)) return;
      patchAvailabilityObject(value[key], depth + 1);
    });
  }

  function patchContentSettings() {
    Object.keys(window)
      .filter((key) => /content|passage|grade|reading/i.test(key))
      .forEach((key) => patchAvailabilityObject(window[key], 0));
  }

  function replaceLockedWords(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      if (lockedText.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(lockedText, "Ready");
      }
    });
  }

  function getGradeFourReference() {
    const controls = Array.from(document.querySelectorAll(gradeControlSelector));

    return controls
      .filter((control) => {
        const label = textOf(control);
        return gradeFourText.test(label) && !lockedText.test(label);
      })
      .sort((a, b) => {
        const aScore = (a.hasAttribute("data-action") ? 2 : 0) + (a.hasAttribute("data-grade") ? 1 : 0);
        const bScore = (b.hasAttribute("data-action") ? 2 : 0) + (b.hasAttribute("data-grade") ? 1 : 0);
        return bScore - aScore;
      })[0];
  }

  function gradeFiveValue(value) {
    if (!value) return value;

    return String(value)
      .replace(/\b4\b/g, "5")
      .replace(/\bgrade[-_\s]*4\b/gi, "grade5")
      .replace(/\bg[-_\s]*4\b/gi, "g5")
      .replace(/\bfour\b/gi, "five");
  }

  function copyWorkingGradeAttributes(target) {
    const reference = getGradeFourReference();
    if (!reference || reference === target) return;

    Array.from(reference.attributes || []).forEach((attribute) => {
      if (!attribute.name.startsWith("data-")) return;
      target.setAttribute(attribute.name, gradeFiveValue(attribute.value));
    });

    if (reference.hasAttribute("value")) {
      target.setAttribute("value", gradeFiveValue(reference.getAttribute("value")));
    }

    target.setAttribute("data-grade", "5");
    target.setAttribute("data-value", "5");
  }

  function unlockControl(control) {
    if (!control || !gradeFiveText.test(textOf(control))) return;

    const target = control.closest(gradeControlSelector) || control;

    if ("disabled" in target) target.disabled = false;
    target.removeAttribute("disabled");
    target.removeAttribute("aria-disabled");
    copyWorkingGradeAttributes(target);
    target.setAttribute("data-grade", "5");
    target.setAttribute("data-value", "5");
    if (!target.getAttribute("data-action")) target.setAttribute("data-action", "select-grade");

    ["disabled", "is-disabled", "locked", "is-locked", "soon", "coming-soon", "unavailable"].forEach((className) => {
      target.classList.remove(className);
    });

    target.querySelectorAll("[disabled], [aria-disabled]").forEach((child) => {
      if ("disabled" in child) child.disabled = false;
      child.removeAttribute("disabled");
      child.removeAttribute("aria-disabled");
    });

    replaceLockedWords(target);
  }

  function unlockGradeFiveControls() {
    document
      .querySelectorAll(gradeControlSelector)
      .forEach((control) => {
        if (gradeFiveText.test(textOf(control))) unlockControl(control);
      });
  }

  function applyUnlock() {
    patchContentSettings();
    unlockGradeFiveControls();
  }

  document.addEventListener(
    "click",
    (event) => {
      const control = event.target.closest(
        gradeControlSelector
      );
      if (control && gradeFiveText.test(textOf(control))) unlockControl(control);
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyUnlock);
  } else {
    applyUnlock();
  }

  new MutationObserver(applyUnlock).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  setTimeout(applyUnlock, 0);
  setTimeout(applyUnlock, 500);
})();
