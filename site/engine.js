// Data processing engine — pure functions for the multimeter browser
// All functions are pure: no mutation of inputs, no I/O, no DOM access.

function notImplemented(name) {
  return function () {
    throw new Error(`${name} not implemented`);
  };
}

export const escapeHtml = notImplemented("escapeHtml");
export const highlightMatch = notImplemented("highlightMatch");
export const parseNumericValue = notImplemented("parseNumericValue");
export const getCellColors = notImplemented("getCellColors");
export const filterRows = notImplemented("filterRows");
export const sortRows = notImplemented("sortRows");
export const searchRows = notImplemented("searchRows");
export const getBandColumns = notImplemented("getBandColumns");
export const getFlagColumns = notImplemented("getFlagColumns");
export const getNumericColumns = notImplemented("getNumericColumns");
