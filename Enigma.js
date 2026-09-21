class Enigma {
    static machines = {};
    #settings = {};
    #initialSettings;
    #charCount = 0;
    constructor(params) {
        this.settings = params;
    }

    // Utils for mapping numbers to letters and vice versa (a=0,b=1...z=25)
    #toInt (c) {
        if (/^[A-Za-z]$/.test(c))
            return c.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        else return parseInt(c);
    }

    #toChar(c) {
        if (/^[A-Za-z]$/.test(c))
            return c.toUpperCase();
        else return String.fromCharCode(c + 'A'.charCodeAt(0));
    }
    
    // Methods to get current and initial settings upon request
    get settings() {
        return this.#settings;
    }
    
    get initialSettings() {
        return this.#initialSettings;
    }

    // Just resets the machine to its intial settings before any typing moved it
    reset() {
        this.#settings = this.#initialSettings;
        this.#charCount = 0;
    }

    
    // Converts a set of parameters designed for a M3 and adds greek wheel with correct set-up to make an M4 eqivalent
    set #addBlank(params) {
        params.model = "x";
        if ("rotors" in params) 
            params.rotors.unshift("empty")
        if ("positions" in params) 
            params.positions.unshift(0);
        if ("settings" in params) 
            params.settings.unshift(0);
        this.settings = params;
    }

    // Takes in an object which can include some or all of the settings and will set them as required
    set settings (params) {
        if (params.model != "x" && !("greekRotors" in Enigma.machines[params.model])) {
            this.#settings.model = params.model;
            this.#addBlank = params; 
            return;
        }
        else if (params.model != "x") this.#settings.model = params.model;

        if ("rotors" in params) {
            this.#settings.rotors = [], this.#settings.notches = [];
            if (params.rotors[0]=="empty")
                this.#settings.rotors.push([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]);
            else
                this.#settings.rotors.push(JSON.parse(JSON.stringify(Enigma.machines[this.#settings.model].greekRotors[params.rotors[0]])));
            this.#settings.notches.push(-1);
            for (let i=1; i<4; i++) {
                this.#settings.rotors.push(JSON.parse(JSON.stringify(Enigma.machines[this.#settings.model].rotors[params.rotors[i]])));
                this.#settings.notches.push(JSON.parse(JSON.stringify(Enigma.machines[this.#settings.model].turnovers[params.rotors[i]])));
            }
        }

        if ("positions" in params) {
            this.#settings.positions = [];
            for (let i=0; i<params.positions.length; i++) 
                this.#settings.positions.push(this.#toInt(params.positions[i]));
        }

        if ("settings" in params) {
            for (let i=0; i<params.settings.length; i++) {
                let currOffset = this.#toInt(params.settings[i]);
                for (let j=0; j<26; j++) {
                    this.#settings.rotors[i][j] += currOffset;
                    this.#settings.rotors[i][j] %= 26;
                }
                for (let j=0; j<currOffset; j++)
                    this.#settings.rotors[i].unshift(this.#settings.rotors[i].pop());
            }
        }
        
        if ("reflector" in params) {
            if (Enigma.machines[this.#settings.model].movingUKW) {
                this.#settings.rotors.push(JSON.parse(JSON.stringify(Enigma.machines[this.#settings.model].ukws[params.reflector])));
                this.#settings.positions.push(parseInt((params.reflectorSettings.position-params.reflectorSettings.settings+26))%26);
            }
            else {
                this.#settings.reflector = new Map();
                for (let i=0; i<26; i++) 
                    this.#settings.reflector.set(i, Enigma.machines[this.#settings.model].ukws[params.reflector][i]);
            }
        }

        if ("switches" in params) {
            this.#settings.switchBoard = new Map();
            if (typeof params.switches == "string")
                params.switches = params.switches.split(" ");
            for (let i=0; i<params.switches.length; i++) {
                if (params.switches[i]==='' || params.switches[i].length!=2) continue;
                this.#settings.switchBoard.set(this.#toInt(params.switches[i][0]), this.#toInt(params.switches[i][1]));
                this.#settings.switchBoard.set(this.#toInt(params.switches[i][1]), this.#toInt(params.switches[i][0]));
            }
        }

        if ("mode" in params) {
            this.#settings.mode = params.mode;
        }
        this.#settings.etw = Enigma.machines[this.#settings.model].etw;
        this.#initialSettings = this.#settings;
        this.#charCount = 0;
    }

    // Rotates the last wheels 1 place, then accounts for any turnovers that may have happened
    #rotate() {
        let positions = this.#settings.positions, notches = this.#settings.notches;

        // if the second rotor is on turnover then double step
        if (notches[2].includes(positions[2])) {
            positions[1] = (positions[1] + 1) % 26;
            positions[2] = (positions[2] + 1) % 26;
        }

        if (notches[3].includes(positions[3]))
            positions[2] = (positions[2] + 1) % 26;
        positions[3] = (positions[3] + 1) % 26;

        this.#settings.positions = positions;
        this.#settings.notches = notches;
        return this.#settings;
    }

    // Pass a single character through the switchboard
    #switchBoard(n) {
        return this.#settings.switchBoard.has(n) ? this.#settings.switchBoard.get(n) : n;
    }
    
    // Pass a single character forward or backwards through a wheel of the machine
    #typeForward(rotor, n) {
        n = this.#settings.rotors[rotor][ (n+this.#settings.positions[rotor])%26 ];
        return (n - this.#settings.positions[rotor] + 26)%26;
    }

    #typeBackward(rotor, n) {
        let pos = this.#settings.rotors[rotor].indexOf((n + this.#settings.positions[rotor]) % 26);
        return (pos - this.#settings.positions[rotor] + 26)%26;
    }

    // Pass a single character through the reflector
    #reflect(n) {
        return Enigma.machines[this.#settings.model].movingUKW ? this.#typeForward(4, n) : this.#settings.reflector.get(n);      
    }

    // Pass a single character through the entrance wheel, etwIn for when it is going into the rotors entered, etwOut for when it is coming back out of the other rotors
    #etwIn(n) {
        for (let i=0; i<26; i++)
            if (this.#settings.etw[i]==n)
                return i;
    }
    
    #etwOut(n) {
        return this.#settings.etw[n];
    }
    // Enter a string or single charcter into the machine and return output, along with an object showing the process at each stage
    type(str) {
        if (str.length!=1) {
            let out_str = "", out_debug = [];
            if (this.#settings.mode=="include") {
                for (let c of str) {
                    let res = this.type(c);
                    out_str += res.str;
                    out_debug.push(...res.debug);
                }
            }
            else {
                for (let c of str) {
                    let res = this.type(c);
                    if (res.str !== "") {
                        out_str += res.str;
                        out_debug.push(...res.debug);
                    }
                }
            }
            return {str: out_str, debug: out_debug};
        }
        else {
            if (str.toUpperCase() == str.toLowerCase()) {
                if (this.#settings.mode == "include") {
                    return {str: str, debug: [{alpha: 0, input: str, output: str}]};
                } else {
                    return {str: "", debug: []};
                }
            }
            let out = {alpha: 1, switch: {}, rotors:{forward:{}, backward:{}}, etw: {}};
            out.settings = JSON.parse(JSON.stringify(this.#rotate()));
            let n = this.#toInt(str);                   out.input = str;
            n = this.#switchBoard(n);                   out.switch.A = this.#toChar(n);
            n = this.#etwIn(n);                         out.etw.in = this.#toChar(n);
            n = this.#typeForward(3,n);                 out.rotors.forward.C = this.#toChar(n);
            n = this.#typeForward(2,n);                 out.rotors.forward.B = this.#toChar(n);
            n = this.#typeForward(1,n);                 out.rotors.forward.A = this.#toChar(n);
            n = this.#typeForward(0,n);                 if (this.#settings.model=="M4") out.rotors.forward.G = this.#toChar(n);
            n = this.#reflect(n);                       out.reflect = this.#toChar(n);
            n = this.#typeBackward(0,n);                if (this.#settings.model=="M4") out.rotors.backward.G = this.#toChar(n);
            n = this.#typeBackward(1,n);                out.rotors.backward.A = this.#toChar(n);
            n = this.#typeBackward(2,n);                out.rotors.backward.B = this.#toChar(n);
            n = this.#typeBackward(3,n);                out.rotors.backward.C = this.#toChar(n);
            n = this.#etwOut(n);                        out.etw.out = this.#toChar(n);
            n = this.#switchBoard(n);                   out.switch.B = this.#toChar(n);
            out.output = this.#toChar(n);

            this.#charCount++;
            let debug_arr = [out];
            let ret_str = out.output;
            if (this.#settings.mode !== "include" && this.#charCount % 5 === 0) {
                ret_str += " ";
                debug_arr.push({str: " ", debug:[{alpha:0, input: "", output:" "}]});
            }
            return {str: ret_str, debug: debug_arr};
        }
    }
}