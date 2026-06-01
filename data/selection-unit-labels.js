(function () {
  const data = window.READING_SELECTIONS_DATA;
  if (!data || !Array.isArray(data.selections)) return;

  data.selections.forEach((selection) => {
    if (!selection || selection._unitWeekTitleApplied) return;
    const unit = Number(selection.unit);
    const week = Number(selection.week);
    if (!unit || !week || typeof selection.title !== "string") return;

    const cleanTitle = selection.title.replace(/^Unit\s+\d+,\s*Week\s+\d+:\s*/i, "");
    selection.title = `Unit ${unit}, Week ${week}: ${cleanTitle}`;
    selection._unitWeekTitleApplied = true;
  });
})();
