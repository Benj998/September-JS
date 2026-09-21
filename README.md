# Enigma
 - Started as just a JS port of my original commandline simulater in CPP
 - Improved it to support many more Enigma machines, as well as being extendable to a custom engima design (e.g. modifying wirings in wheels, whether or not there is a greek wheel or  switchboard, whether or not the UKW can be set to different positions and ring settings etc.). Look at machines.json for examples.
- Supports 
    - Enigma I
    - Enigma M1 / M2 / M3 (all functionally equivalent)
    - Engima M4
    - Engima D / K (functionally equivalent)
    - Swiss-K Enigma (Air force wirings as these are the only ones recovered)
    - Norway Enigma 
    - Sondermaschine (Special machine)

# Use notes
 - Settings on display will update live as characters are encrypted (like a real Enigma machine)
 - Switching settings while text is already in the input box will treat what you have set as starting settings (so it will encrypt already entered, then update the settings to the current point)
 - Re-opening the page will default back to your last used settings
 - To save settings, use the "Export Settings URL" button to copy a link that will open the page to those exact settings
