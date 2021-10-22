// column-highlights the hovered x index
export default function columnHighlightPlugin({ className, style = {backgroundColor: "rgba(51,204,255,0.3)"} } = {}) {
    let underEl, overEl, highlightEl, currIdx;

    function init(u) {
        underEl = u.under;
        overEl = u.over;

        highlightEl = document.createElement("div");

        className && highlightEl.classList.add(className);

        uPlot.assign(highlightEl.style, {
            pointerEvents: "none",
            display: "none",
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            ...style
        });

        underEl.appendChild(highlightEl);

        // show/hide highlight on enter/exit
        overEl.addEventListener("mouseenter", () => {highlightEl.style.display = null;});
        overEl.addEventListener("mouseleave", () => {highlightEl.style.display = "none";});
    }

    function update(u) {
        if (currIdx !== u.cursor.idx) {
            currIdx = u.cursor.idx;

            let [iMin, iMax] = u.series[0].idxs;

            const dx    = iMax - iMin;
            const width = (u.bbox.width / dx) / devicePixelRatio;
            const xVal  = u.scales.x.distr == 2 ? currIdx : u.data[0][currIdx];
            const left  = u.valToPos(xVal, "x") - width / 2;

            highlightEl.style.transform = "translateX(" + Math.round(left) + "px)";
            highlightEl.style.width = Math.round(width) + "px";
        }
    }

    return {
        opts: (u, opts) => {
            uPlot.assign(opts, {
                cursor: {
                    x: false,
                    y: false,
                }
            });
        },
        hooks: {
            init: init,
            setCursor: update,
        }
    };
}
