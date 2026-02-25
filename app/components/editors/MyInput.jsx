import ModalEditor from '../../pages/DsView/components/ModalEditor';
import React from 'react';
import { createRoot } from 'react-dom/client';

function MyInput(cell, onRendered, success, cancel, editorParams, ctrlKey) {
    console.log('[MyInput] Called with:', { 
        cellValue: cell.getValue(), 
        ctrlKey, 
        hasEditorParams: !!editorParams,
        dsName: editorParams?.dsName 
    });
    
    var cellValue = cell.getValue(),
        value = String(cellValue !== null && typeof cellValue !== "undefined" ? cellValue : ""),
        input = document.createElement("input");

    input.setAttribute("type", (editorParams && editorParams.search) || "text");

    //create and style input
    input.style.padding = "4px";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    if (editorParams.elementAttributes && typeof editorParams.elementAttributes == "object") {
        for (let key in editorParams.elementAttributes) {
            if (key.charAt(0) == "+") {
                key = key.slice(1);
                input.setAttribute(key, input.getAttribute(key) + editorParams.elementAttributes["+" + key]);
            } else {
                input.setAttribute(key, editorParams.elementAttributes[key]);
            }
        }
    }

    input.value = value;

    // If Ctrl+Click, open modal CodeMirror editor
    if (ctrlKey) {
        // Hide the input element since we're using modal editor
        input.style.display = "none";
        
        let cellWidth = cell._cell.element.style.width;
        let div = document.createElement("div");
        document.body.appendChild(div);
        let cmRef = {};
        let root = null;
        const PopupContent = () => {
            return (
                <ModalEditor show={true} 
                    title={"Edit"} text={value} onClose={clear} editorParams={editorParams || {}}
                    cancel={"Cancel"} ok={"Done"} cmRef={cmRef} width={cellWidth}>
                </ModalEditor>
            );
        };
        
        const clear = (ok, value) => {
            if (root) root.unmount();
            div.remove();
            if (ok && (input.value != value)) {
                success(value);
                cellValue = value;
            } else {
                cancel();
            }
        }
        root = createRoot(div);
        root.render(<PopupContent/>);
    }

    onRendered(function () {
        if (!ctrlKey) {
            input.focus({
                preventScroll: true
            });
            input.select();
        }
    });

    var editCompleted = false;

    function onChange(e) {
        if (editCompleted) {
            return;
        }

        if (((cellValue === null || typeof cellValue === "undefined") && input.value !== "") || input.value !== cellValue) {
            if (success(input.value)) {
                editCompleted = true;
                cellValue = input.value;
            }
        } else {
            editCompleted = true;
            cancel();
        }
    }

    //submit new value on blur or change
    input.addEventListener("change", onChange);
    input.addEventListener("blur", onChange);

    //submit new value on enter
    input.addEventListener("keydown", function (e) {
        switch (e.keyCode) {
            case 13:
                onChange(e);
                break;

            case 27:
                cancel();
                break;
                
            case 35:
            case 36:
                e.stopPropagation();
                break;
        }
    });

    if (editorParams.mask) {
        this.table.modules.edit.maskInput(input, editorParams);
    }

    return input;
}

export default MyInput;
