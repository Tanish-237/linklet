import React, { useId, useMemo, useRef, useState } from "react";

/**
 * Type-to-search subject field, used two ways:
 *  - Upload form (allowCreate): pick an existing subject or "Add … as a new
 *    subject". Picking an existing one keeps names consistent so the subject
 *    filter doesn't list duplicates. The list opens inline because the upload
 *    modal scrolls and would clip a floating one.
 *  - Resource Hub filter (floating, no create): search subjects and pick one.
 *
 * `value` is the text in the box; `onSelect` fires when an option is picked
 * (defaults to `onChange`); `onDismiss` fires when the list closes on blur.
 */
export default function SubjectPicker({
  id,
  value,
  onChange,
  onSelect = onChange,
  onDismiss,
  subjects,
  maxLength,
  disabled = false,
  disabledHint,
  allowCreate = true,
  floating = false,
  placeholder = "Choose a subject or add a new one (optional)",
  emptyText = "No subjects yet. Type one to add it.",
  ariaLabel,
}) {
  const listId = useId();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const query = value.replace(/\s+/g, " ").trim();
  const lower = query.toLowerCase();
  const matches = useMemo(
    () => (lower ? subjects.filter((s) => s.name.toLowerCase().includes(lower)) : subjects),
    [subjects, lower]
  );
  const exact = subjects.find((s) => s.name.toLowerCase() === lower);
  const options = [
    ...matches.map((s) => ({ type: "existing", name: s.name, count: s.count })),
    ...(allowCreate && query && !exact ? [{ type: "new", name: query }] : []),
  ];

  const choose = (option) => {
    onSelect(option.name);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && options[active]) {
      e.preventDefault(); // pick the subject, don't submit the form
      choose(options[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const showList = open && !disabled;

  return (
    <div className={`gs-subject-picker ${floating ? "is-floating" : ""}`}>
      <div className="gs-subject-input-wrap">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={disabled ? disabledHint : placeholder}
          autoComplete="off"
          onFocus={() => { setOpen(true); setActive(0); }}
          onClick={() => setOpen(true)}
          onBlur={() => { setOpen(false); onDismiss?.(); }}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="gs-subject-clear"
            aria-label="Clear subject"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onSelect(""); inputRef.current?.focus(); }}
          >
            <span className="material-icons" aria-hidden="true">close</span>
          </button>
        ) : (
          <span className="material-icons gs-subject-chevron" aria-hidden="true">expand_more</span>
        )}
      </div>

      {showList && (
        <ul id={listId} role="listbox" className="gs-subject-list">
          {options.length === 0 && (
            <li className="gs-subject-empty">{emptyText}</li>
          )}
          {options.map((option, i) => (
            <li
              key={`${option.type}:${option.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`gs-subject-option ${i === active ? "active" : ""} ${option.type === "new" ? "is-new" : ""}`}
              // mousedown, not click: fires before the input's blur closes the list
              onMouseDown={(e) => { e.preventDefault(); choose(option); }}
              onMouseEnter={() => setActive(i)}
            >
              {option.type === "new" ? (
                <>
                  <span className="material-icons" aria-hidden="true">add</span>
                  <span>Add “{option.name}” as a new subject</span>
                </>
              ) : (
                <>
                  <span className="gs-subject-name">{option.name}</span>
                  <span className="gs-subject-count">{option.count}</span>
                  {option.name === value && <span className="material-icons gs-subject-check" aria-hidden="true">check</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
