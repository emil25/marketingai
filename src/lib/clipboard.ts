/** Clipboard API first; embedded browsers may require the selection-based fallback. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const focus = document.activeElement;
    const selection = document.getSelection();
    const ranges = selection
      ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange())
      : [];
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("aria-label", "Másolandó szöveg");
    input.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(input);
    input.select();
    try {
      if (!document.execCommand("copy"))
        throw new Error(
          "A böngésző nem engedte a másolást. Jelöld ki a szöveget, és másold kézzel.",
        );
    } finally {
      input.remove();
      if (focus instanceof HTMLElement) focus.focus({ preventScroll: true });
      selection?.removeAllRanges();
      ranges.forEach((range) => selection?.addRange(range));
    }
  }
}
