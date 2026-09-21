var enigma, prevInput = "";
$(document).ready(_ => { 
    let modelSelect = $("#model")[0]; 
    for (e in Enigma.machines)
        $("<option value='" + e + "'>" + e + "</option>").appendTo(modelSelect);
});

const modelChange = _ => {
    const defaultRotors = ["Beta", "I", "II", "III"];
    let model = $("#model")[0].value, table = $("#table")[0], ukw = $("#ukw");
    $("#output")[0].hidden = false;
    $("#inputSettings")[0].hidden = false;
    if (!(Enigma.machines[model].switchBoard)) {
        $("#switches")[0].hidden = true;
        $("#switches")[0].value = "";
    }
    else 
        $("#switches")[0].hidden = false;
    // If the ukw is static, set the option boxes
    if (!(Enigma.machines[model].movingUKW)) {
        ukw[0].hidden = false;
        ukw.empty()
        for (let e in Enigma.machines[model].ukws) 
            $("<option value='" + e + "'>" + e + "</option>").appendTo(ukw);
    }
    else
        ukw[0].hidden = true;

    // Clear previous table
    while (table.rows.length)
        table.deleteRow(0);

    // Table headers
    let row = table.insertRow(0);
    $("<th></th>").appendTo(row);
    if (Enigma.machines[model].movingUKW)
        $("<th>Reflector</th>").appendTo(row);
    if ("greekRotors" in Enigma.machines[model])
        $("<th>Greek Wheel</th>").appendTo(row);
    $("<th>First Wheel</th>").appendTo(row);
    $("<th>Second Wheel</th>").appendTo(row);
    $("<th>Third Wheel</th>").appendTo(row);


    // Rotor selecters
    row = table.insertRow(1);
    $("<th>Rotors</th>").appendTo(row);
    if (Enigma.machines[model].movingUKW) {
        let cell = $("<td></td>");
        let select = $("<select class='selection' name='reflector'></select>");
        for (let e in Enigma.machines[model].ukws) 
            $("<option value='" + e + "'>" + e + "</option>").appendTo(select);
        select.appendTo(cell);
        cell.appendTo(row);
    }
    if ("greekRotors" in Enigma.machines[model]) {
        let cell = $("<td></td>");
        let select = $("<select class='selection' name='rotor0'></select>");
        for (let e in Enigma.machines[model].greekRotors) 
            $("<option value='" + e + "' " + (e==defaultRotors[0]?"selected":"") + ">" + e + "</option>").appendTo(select);
        select.appendTo(cell);
        cell.appendTo(row);
    }
    for (let i=1; i<4; i++) {
        let cell = $("<td></td>");
        let select = $("<select class='selection' name='rotor" + i + "'></select>");
        for (let e in Enigma.machines[model].rotors)
            $("<option value='" + e + "' " + (e==defaultRotors[i]?"selected":"") + ">" + e + "</option>").appendTo(select);
        select.appendTo(cell);
        cell.appendTo(row);
    }

    // Set initial positions of rotors
    row = table.insertRow(2);
    $("<th>Initial Positions</th>").appendTo(row);
    if (Enigma.machines[model].movingUKW) {
        let cell = $("<td></td>");
        let select = $("<select name='reflectorPosition'></select>");
        for (let j=0; j<26; j++)
            $("<option value='" + j + "'>" + String.fromCharCode(j+"A".charCodeAt(0)) + " (" + (j+1) + ")</option>").appendTo(select);
        select.appendTo(cell);
        cell.appendTo(row);
    }
    for (let i=("greekRotors" in Enigma.machines[model]?0:1); i<4; i++) {
        let cell = $("<td></td>");
        let select = $("<select name='position" + i + "'></select>");
        for (let j=0; j<26; j++)
            $("<option value='" + j + "'>" + String.fromCharCode(j+"A".charCodeAt(0)) + " (" + (j+1) + ")</option>").appendTo(select);
        select.appendTo(cell);
        cell.appendTo(row);
    }

    // Set ring settings
    row = table.insertRow(3);
    $("<th>Ring Settings</th>").appendTo(row);
    if (Enigma.machines[model].movingUKW) {
        let cell = $("<td></td>");
        let select = $("<select name='reflectorSetting'></select>");
        for (let j=0; j<26; j++)
            $("<option value='" + j + "'>" + String.fromCharCode(j+"A".charCodeAt(0)) + " (" + (j+1) + ")</option>").appendTo(select);
        select.appendTo(cell);
        cell.appendTo(row);
    }
    for (let i=("greekRotors" in Enigma.machines[model]?0:1); i<4; i++) {
        let cell = $("<td></td>");
        let select = $("<select name='setting" + i + "'></select>");
        for (let j=0; j<26; j++)
            $("<option value='" + j + "'>" + String.fromCharCode(j+"A".charCodeAt(0)) + " (" + (j+1) + ")</option>").appendTo(select);
        select.appendTo(cell);
        cell.appendTo(row);
    }
    $("#form").off("change").on("change", (e) => {
        if (e.target.id !== "inputText" && e.target.id !== "model") encode(true);
    });
    encode(true);
}

const inputChange = _ => {
    let newInput = $("#inputText").val();
    if (newInput.length==prevInput.length+1 && newInput.slice(0,-1)==prevInput)
        encode(false);
    else
        encode(true);
    prevInput = newInput;
}

const encode = hasChanged => {
    var output;
    if (hasChanged) {
        let data = new FormData($("#form")[0]);
        let settings = {
            model: data.get("model"),
            reflector: Enigma.machines[data.get("model")].movingUKW ? data.get("reflector") : data.get("ukw"),
            rotors: [data.get("rotor1"), data.get("rotor2"), data.get("rotor3")],
            positions: [data.get("position1"), data.get("position2"), data.get("position3")],
            settings: [data.get("setting1"), data.get("setting2"), data.get("setting3")],
            switches: data.get("switches"),
            mode: data.get("mode")
        }; 

        if ("greekRotors" in Enigma.machines[data.get("model")]) {
            settings.rotors.unshift(data.get("rotor0"));
            settings.positions.unshift(data.get("position0"));
            settings.settings.unshift(data.get("setting0"));
        }

        if (Enigma.machines[data.get("model")].movingUKW)
            settings.reflectorSettings = {
                position: data.get("reflectorPosition"),
                settings: data.get("reflectorSetting")
            };

        console.log("Inputted settings:");
        console.log(settings);
        enigma = new Enigma(settings);
        hasChanged = false;
        output = enigma.type(data.get("inputText"))
        $("#outputBox")[0].value = output.str;
    }
    else {
        output = enigma.type($("#inputText").val().at(-1))
        $("#outputBox")[0].value += output.str;
    }
    console.log(output);
}