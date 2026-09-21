const { useState, useEffect, useRef, useMemo, useCallback } = React;

// cookies
const setCookie = (name, value, days = 365) => {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
};

const getCookie = (name) => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    // begins either at start of doc, or after "; ", ends at next ";"
    return match ? decodeURIComponent(match[1]) : null;
};

// plugboard input checks
const validatePlugboard = (str) => {
    if (!str || str.trim() === "") return { status: "ok", message: "" };

    const tokens = str.toUpperCase().trim().split(/\s+/);
    const seen = new Set();

    for (const tok of tokens) {
        if (tok.length !== 2 || !/^[A-Z]{2}$/.test(tok)) {
            return { status: "error", message: `"${tok}" is not a valid pair (need 2 letters)` };
        }
        if (tok[0] === tok[1]) {
            return { status: "error", message: `"${tok}" connects a letter to itself` };
        }
        if (seen.has(tok[0])) {
            return { status: "error", message: `Letter ${tok[0]} is used in more than one pair` };
        }
        if (seen.has(tok[1])) {
            return { status: "error", message: `Letter ${tok[1]} is used in more than one pair` };
        }
        seen.add(tok[0]);
        seen.add(tok[1]);
    }

    if (tokens.length > 10) {
        return {
            status: "warning",
            message: `Historically at most 10 cables were used (you have ${tokens.length})`
        };
    }

    return { status: "ok", message: "" };
};

// position carousels
const ITEM_H = 32;

const Carousel = ({ options, value, onChange }) => {
    const ref = useRef(null);
    const suppressSnap = useRef(false);
    const scrollTimer = useRef(null);
    const [padH, setPadH] = useState(0);

    // Measure container height to center top/bottom items
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const h = Math.floor(el.clientHeight / 2 - ITEM_H / 2);
        setPadH(Math.max(h, 0));
    }, []);

    // Smoothly scroll to selected option when value changes programmatically
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const idx = options.findIndex(o => String(o.value) === String(value));
        if (idx >= 0) {
            const targetTop = idx * ITEM_H;
            if (Math.abs(el.scrollTop - targetTop) > 1) {
                suppressSnap.current = true;
                el.scrollTo({ top: targetTop, behavior: 'smooth' });
                clearTimeout(scrollTimer.current);
                scrollTimer.current = setTimeout(() => {
                    suppressSnap.current = false;
                }, 300);
            }
        }
    }, [value, options]);

    // Handle scroll snapping & user selection
    const onScroll = () => {
        if (suppressSnap.current) return;
        clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
            const el = ref.current;
            if (!el || suppressSnap.current) return;
            const idx = Math.round(el.scrollTop / ITEM_H);
            if (options[idx] && String(options[idx].value) !== String(value)) {
                onChange(options[idx].value);
            }
        }, 120);
    };

    return (
        <div className="scroll-carousel" ref={ref} onScroll={onScroll}>
            <div className="sc-pad" style={{ height: padH }} />
            {options.map(opt => (
                <div
                    key={opt.value}
                    className={`sc-item${String(opt.value) === String(value) ? " active" : ""}`}
                    onClick={() => {
                        onChange(opt.value);
                    }}
                >
                    {opt.label}
                </div>
            ))}
            <div className="sc-pad" style={{ height: padH }} />
        </div>
    );
};

// helpers
const POS_OPTIONS = Array.from({ length: 26 }, (_, i) => ({ // labels for rotor positions in letters not ints
    value: i,
    label: `${String.fromCharCode(65 + i)} (${i + 1})`
}));

const DEFAULT_ROTORS = ["Beta", "I", "II", "III"];

/* ═══════════════════════════════════════════════
   App
   ═══════════════════════════════════════════════ */
const App = () => {
    const [ready, setReady] = useState(false);

    // Machine config state
    const [model, setModel] = useState("Enigma I");
    const [reflector, setReflector] = useState("UKW-B");
    const [mode, setMode] = useState("include");
    const [switches, setSwitches] = useState("");
    const [rotors, setRotors] = useState(["I", "II", "III"]);
    const [ringSettings, setRingSettings] = useState([0, 0, 0]);

    // User-set initial/base positions (used to instantiate Enigma)
    const [basePositions, setBasePositions] = useState([0, 0, 0]);
    const [baseReflectorPos, setBaseReflectorPos] = useState(0);

    // Live display positions (updated as rotors step during typing)
    const [displayPositions, setDisplayPositions] = useState([0, 0, 0]);
    const [displayReflectorPos, setDisplayReflectorPos] = useState(0);

    // Text
    const [inputText, setInputText] = useState("");
    const [outputText, setOutputText] = useState("");

    const enigmaRef = useRef(null);
    const prevInputRef = useRef("");

    /* ── Load machines.json, then hydrate from URL param or cookie ── */
    useEffect(() => {
        fetch("machines.json")
            .then(r => r.json())
            .then(data => {
                Enigma.machines = data;

                const params = new URLSearchParams(window.location.search);
                const b64 = params.get("settings");
                let init = null;
                if (b64) {
                    try { init = JSON.parse(atob(b64)); } catch (e) { /* ignore */ }
                }
                if (!init) {
                    const ck = getCookie("enigmaSettings");
                    if (ck) {
                        try { init = JSON.parse(ck); } catch (e) { /* ignore */ }
                    }
                }
                if (init && Enigma.machines[init.model]) {
                    setModel(init.model);
                    if (init.reflector) setReflector(init.reflector);
                    if (init.mode) setMode(init.mode);
                    if (init.switches !== undefined) setSwitches(init.switches);
                    if (init.rotors) setRotors(init.rotors);
                    if (init.positions) {
                        setBasePositions(init.positions);
                        setDisplayPositions(init.positions);
                    }
                    if (init.settings) setRingSettings(init.settings);
                    if (init.reflectorSettings) {
                        const p = init.reflectorSettings.position || 0;
                        setBaseReflectorPos(p);
                        setDisplayReflectorPos(p);
                    }
                }
                // Strip URL param so page stays clean
                if (b64) {
                    const url = new URL(window.location);
                    url.searchParams.delete("settings");
                    window.history.replaceState(null, "", url.toString());
                }
                setReady(true);
            });
    }, []);

    /* ── Build config object from BASE settings ── */
    const buildConfig = useCallback(() => {
        const machine = Enigma.machines[model];
        if (!machine) return null;
        const cfg = {
            model,
            mode,
            switches,
            rotors: [...rotors],
            positions: [...basePositions],
            settings: [...ringSettings],
            reflector
        };
        if (machine.movingUKW) {
            cfg.reflectorSettings = { position: baseReflectorPos, settings: 0 };
        }
        return cfg;
    }, [model, mode, switches, rotors, basePositions, ringSettings, reflector, baseReflectorPos]);

    // Persist to cookie & re-init Enigma whenever base config changes 
    const configKey = useMemo(() => JSON.stringify(buildConfig()), [buildConfig]);

    // read live positions from Enigma and update display state 
    const syncPositionsFromEnigma = useCallback(() => {
        if (!enigmaRef.current) return;
        const machine = Enigma.machines[model];
        if (!machine) return;
        const hasGreek = "greekRotors" in machine;
        const intPos = enigmaRef.current.settings.positions;
        if (!intPos) return;

        const newPos = hasGreek ? intPos.slice(0, 4) : intPos.slice(1, 4);
        setDisplayPositions(newPos);

        if (machine.movingUKW && intPos.length > 4) {
            setDisplayReflectorPos(intPos[4]);
        }
    }, [model]);

    useEffect(() => {
        if (!ready) return;
        const cfg = JSON.parse(configKey);
        if (!cfg) return;

        // Persist base config to cookie
        setCookie("enigmaSettings", JSON.stringify(cfg));

        // Re-create Enigma from base positions and re-encode current input
        try {
            enigmaRef.current = new Enigma(cfg);
            const out = enigmaRef.current.type(inputText);
            setOutputText(out.str);
            prevInputRef.current = inputText;
            syncPositionsFromEnigma();
        } catch (e) {
            console.error("Enigma init error:", e);
        }
    }, [configKey, ready, syncPositionsFromEnigma]);

    // handlers for manual setting changes
    const handleUserPosChange = (idx, val) => {
        setBasePositions(prev => { const a = [...prev]; a[idx] = val; return a; });
        setDisplayPositions(prev => { const a = [...prev]; a[idx] = val; return a; });
    };

    const handleUserReflectorPosChange = (val) => {
        setBaseReflectorPos(val);
        setDisplayReflectorPos(val);
    };

    /* ── Text input handler ── */
    const handleInput = (e) => {
        const v = e.target.value;
        if (!enigmaRef.current) { setInputText(v); return; }

        if (v.length === prevInputRef.current.length + 1 &&
            v.slice(0, -1) === prevInputRef.current) {
            // Fast path: append single char
            const out = enigmaRef.current.type(v.at(-1));
            setOutputText(prev => prev + out.str);
        } else {
            // Edit/delete path: rebuild from BASE config and re-encode remaining string
            const cfg = buildConfig();
            enigmaRef.current = new Enigma(cfg);
            const out = enigmaRef.current.type(v);
            setOutputText(out.str);
        }
        prevInputRef.current = v;
        setInputText(v);

        // Update display positions to match current rotor state after encoding
        syncPositionsFromEnigma();
    };

    /* ── Model change resets all wheel settings ── */
    const handleModelChange = (e) => {
        const m = e.target.value;
        const machine = Enigma.machines[m];
        const hasGreek = "greekRotors" in machine;
        const newRotors = hasGreek
            ? [DEFAULT_ROTORS[0], DEFAULT_ROTORS[1], DEFAULT_ROTORS[2], DEFAULT_ROTORS[3]]
            : [DEFAULT_ROTORS[1], DEFAULT_ROTORS[2], DEFAULT_ROTORS[3]];
        const zeroPos = newRotors.map(() => 0);
        setModel(m);
        setRotors(newRotors);
        setBasePositions(zeroPos);
        setDisplayPositions(zeroPos);
        setRingSettings(newRotors.map(() => 0));
        setReflector(Object.keys(machine.ukws)[0]);
        setBaseReflectorPos(0);
        setDisplayReflectorPos(0);
        if (!machine.switchBoard) setSwitches("");
    };

    const setArr = (setter, idx, val) => {
        setter(prev => { const a = [...prev]; a[idx] = val; return a; });
    };

    // Export URL
    const exportUrl = () => {
        const cfg = buildConfig();
        const b64 = btoa(JSON.stringify(cfg));
        const url = new URL(window.location);
        url.searchParams.set("settings", b64);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url.toString())
                .then(() => alert("Settings URL copied to clipboard!"))
                .catch(() => prompt("Copy your settings URL:", url.toString()));
        } else {
            prompt("Copy your settings URL:", url.toString());
        }
    };

    if (!ready) return <div style={{ color: "#7b92aa", textAlign: "center", marginTop: 40 }}>Loading…</div>;

    const machine = Enigma.machines[model];
    if (!machine) return null;

    const hasGreek = "greekRotors" in machine;
    const isMoving = machine.movingUKW;
    const hasSB = machine.switchBoard;
    const plugValidation = hasSB ? validatePlugboard(switches) : { status: "ok", message: "" };

    // Build column definitions for grid 
    const cols = [];

    // Reflector
    const ukwOpts = Object.keys(machine.ukws).map(k => ({ value: k, label: k }));
    cols.push({
        key: "ukw", label: "Reflector",
        wheelOpts: ukwOpts,
        wheelVal: reflector, wheelSet: setReflector,
        showPos: isMoving,
        posVal: isMoving ? displayReflectorPos : 0,
        posSet: handleUserReflectorPosChange,
        showRing: false,
        ringVal: 0, ringSet: () => {}
    });

    // Greek wheel (M4)
    if (hasGreek) {
        const gOpts = Object.keys(machine.greekRotors).map(k => ({ value: k, label: k }));
        cols.push({
            key: "greek", label: "Greek",
            wheelOpts: gOpts,
            wheelVal: rotors[0], wheelSet: v => setArr(setRotors, 0, v),
            showPos: true,
            posVal: displayPositions[0], posSet: v => handleUserPosChange(0, v),
            showRing: true,
            ringVal: ringSettings[0], ringSet: v => setArr(setRingSettings, 0, v)
        });
    }

    // Normal rotors
    const rOpts = Object.keys(machine.rotors).map(k => ({ value: k, label: k }));
    ["Left", "Middle", "Right"].forEach((lbl, i) => {
        const si = hasGreek ? i + 1 : i;
        cols.push({
            key: `r${i}`, label: lbl,
            wheelOpts: rOpts,
            wheelVal: rotors[si], wheelSet: v => setArr(setRotors, si, v),
            showPos: true,
            posVal: displayPositions[si], posSet: v => handleUserPosChange(si, v),
            showRing: true,
            ringVal: ringSettings[si], ringSet: v => setArr(setRingSettings, si, v)
        });
    });

    const showPos = cols.some(c => c.showPos);
    const showRing = cols.some(c => c.showRing);
    const rowCount = 1 + (showPos ? 1 : 0) + (showRing ? 1 : 0);

    const gridStyle = {
        gridTemplateColumns: `80px repeat(${cols.length}, 1fr)`,
        gridTemplateRows: `auto ${"1fr ".repeat(rowCount).trim()}`
    };

    return (
        <div className="app-shell">
            {/* Top bar */}
            <div className="top-bar">
                <h1>Enigma Emulator</h1>
                <button className="btn-share" onClick={exportUrl}>Export Settings URL</button>
            </div>

            {/* Controls row */}
            <div className="controls-row">
                <select value={model} onChange={handleModelChange}>
                    {Object.keys(Enigma.machines).map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <select value={mode} onChange={e => setMode(e.target.value)}>
                    <option value="include">Include foreign characters</option>
                    <option value="ignore">Ignore foreign characters</option>
                </select>
                {hasSB && (
                    <div className={`plugboard-wrap plugboard-${plugValidation.status}`}>
                        <input
                            type="text"
                            placeholder="Plugboard (AB CD EF …)"
                            value={switches}
                            onChange={e => setSwitches(e.target.value)}
                        />
                        {plugValidation.message && (
                            <div className="plugboard-msg">
                                <strong>Plugboard:</strong> {plugValidation.message}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Configuration grid */}
            <div className="config-panel">
                <div className="config-grid" style={gridStyle}>
                    <div className="grid-corner" />
                    {cols.map(c => (
                        <div key={c.key} className="grid-header">{c.label}</div>
                    ))}

                    <div className="grid-row-label">Wheel</div>
                    {cols.map(c => (
                        <Carousel key={`w-${c.key}`} options={c.wheelOpts} value={c.wheelVal} onChange={c.wheelSet} />
                    ))}

                    {showPos && (
                        <>
                            <div className="grid-row-label">Position</div>
                            {cols.map(c =>
                                c.showPos
                                    ? <Carousel key={`p-${c.key}`} options={POS_OPTIONS} value={c.posVal} onChange={c.posSet} />
                                    : <div key={`p-${c.key}`} />
                            )}
                        </>
                    )}

                    {showRing && (
                        <>
                            <div className="grid-row-label">Ring</div>
                            {cols.map(c =>
                                c.showRing
                                    ? <Carousel key={`r-${c.key}`} options={POS_OPTIONS} value={c.ringVal} onChange={c.ringSet} />
                                    : <div key={`r-${c.key}`} />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Text areas */}
            <div className="text-row">
                <div className="text-col">
                    <label>Input</label>
                    <textarea
                        placeholder="Type plaintext or ciphertext here…"
                        value={inputText}
                        onChange={handleInput}
                    />
                </div>
                <div className="text-col">
                    <label>Output</label>
                    <textarea
                        placeholder="Result will appear here…"
                        value={outputText}
                        readOnly
                    />
                </div>
            </div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);