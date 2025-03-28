import {A,E,O,Q} from '../AEOQ.mjs';
import PointerInteraction from '../pointer-interaction/script.js';

const audioContext = new AudioContext();
let Knobs = new O([...new FormData(Q('form'))].map(([n, v]) => [n, isNaN(parseFloat(v)) ? v : parseFloat(v)]));
Q('form').oninput = ev => Knobs[ev.target.name] = isNaN(parseFloat(ev.target.value)) ? ev.target.value : parseFloat(ev.target.value);

class Keyboard {
    constructor() {
        this.KB = Q('#keyboard');
        this.init();
        this.events();
    }
    pitches = ['B','B♭','A','A♭','G','G♭','F','E','E♭','D','D♭','C']
    keys = [
        ['Y','7','U','8','I','O','0','P','-','[','=',']'],
        ['Z','S','X','D','C','V','G','B','H','N','J','M'],
    ]
    keyMap = {}
    distanceToMid = C => Math.abs(C.offsetLeft + C.clientWidth/2 - this.KB.scrollLeft - innerWidth/2);
    init() {
        for (let i = 0; i < 60; i++) {
            let button = E('button', {dataset: {
                frequency: 1976 / Math.pow(2, i/12),
                pitch: `${this.pitches[i % this.pitches.length]}${6 - Math.floor(i / this.pitches.length)}`
            }}); //B6
            button.onpointerdown = ev => {
                this.press(button);
                button.onpointerup = button.onpointercancel = button.onpointermove = ev => this.release(button);
            }
            this.KB.prepend(button);
        }
        PointerInteraction.events({'#keyboard': {drag: PI => PI.drag.to.scroll({x: true, y: false})}});
    }
    events() {
        (this.KB.onscroll = () => {
            let keyC = this.KB.Q('[data-pitch^=C]').reduce((min, c) => this.distanceToMid(c) < this.distanceToMid(min) ? c : min);
            if (keyC.dataset.key == 'Y') return;

            this.KB.Q('[data-key]', key => key.removeAttribute('data-key'));
            let key = keyC, i = 0;
            while (this.keys[0][i]) {
                key.dataset.key = this.keys[0][i];
                this.keyMap[this.keys[0][i]] = key;
                key = key.nextElementSibling; i++;
            }
            key = keyC.previousElementSibling, i = 11;
            while (this.keys[1][i]) {
                key.dataset.key = this.keys[1][i];
                this.keyMap[this.keys[1][i]] = key;
                key = key.previousElementSibling; i--;
            }
        })();
        onkeydown = ev => !ev.repeat && this.press(ev.key.toUpperCase());
        onkeyup = ev => this.release(ev.key.toUpperCase());
    }
    press(key) {
        const button = key.tagName == 'BUTTON' ? key : KB.keyMap[key];
        if (!button) return;
    
        const envelope = new Effect('gain', [
            [audioContext.currentTime, 0],
            [Knobs['envelope-a']/100*Knobs['time-scale'], Knobs.volume/100],
            [Knobs['envelope-d']/100*Knobs['time-scale'], Knobs['envelope-s']/100*Knobs.volume/100],
        ]).node;
        const delay = new Effect('delay', Knobs['delay-time']).node;
        const feedback = new Effect('gain', Knobs['delay-feedback']/100).node;
     
        envelope.connect(audioContext.destination); 
        envelope.connect(feedback).connect(delay).connect(audioContext.destination);
        delay.connect(feedback);
    
        const osc = new Oscillators(Knobs.waveform.toLowerCase(), button.dataset.frequency, Knobs['unison-detune-1'], Knobs['unison-detune-2'], envelope);
        new Oscillator('LFO', Knobs['vibrato-speed'], Knobs['vibrato-amount']).connect(osc.osc[0].oscillator.frequency);
        new Oscillator('LFO', 10, 2).connect(envelope);
        
        osc.start();
        Oscillators.map.set(button.dataset.pitch, osc);
    }
    release(key) {
        const button = key.tagName == 'BUTTON' ? key : KB.keyMap[key];
        if (!button) return;
        button.onpointerup = button.onpointercancel = button.onpointermove = null;
          
        Oscillators.map.get(button.dataset.pitch).release(audioContext.currentTime, Knobs['envelope-r']/100*Knobs['time-scale'])
    }
}
let KB = new Keyboard();

class Effect {
    constructor(type, value) {
        this.node = audioContext[`create${type.charAt(0).toUpperCase() + type.slice(1)}`]();
        typeof value == 'object' ? this.automate(type, value) : this.node[Effect.param[type]].value = value;
    }
    automate(type, schedule) {
        this.node[Effect.param[type]]
            .setValueAtTime(schedule[0][1], schedule[0][0])
            .linearRampToValueAtTime(schedule[1][1], schedule[0][0] + schedule[1][0])
            .setTargetAtTime(schedule[2][1], schedule[0][0] + schedule[1][0], schedule[2][0]);
    }
    static param = {
        delay: 'delayTime',
        gain: 'gain'
    }
}
class Oscillator {
    constructor(type, frequency, detune, envelope) {
        this.oscillator = audioContext.createOscillator();
        if (type == 'LFO') {
            this.gain = audioContext.createGain();
            this.gain.gain.setValueAtTime(detune, 0);

            this.oscillator.frequency.setValueAtTime(frequency, 0);
            this.oscillator.start(0);
            this.oscillator.connect(this.gain);
            return;
        }
        this.oscillator.connect(envelope);
        if (type == "custom") {
            let sineTerms = new Float32Array([0, 0, 1, 0, 1]);
            let cosineTerms = new Float32Array(sineTerms.length);
            this.oscillator.setPeriodicWave(audioContext.createPeriodicWave(cosineTerms, sineTerms));
        } 
        else
            this.oscillator.type = type;
        this.oscillator.frequency.value = frequency;
        this.oscillator.detune.value = detune;
    }
    connect(what) {this.gain.connect(what);}
    start() {this.oscillator.start();}
    stop(t) {this.oscillator.stop(t);}
}
 
class Oscillators {
    constructor(type, frequency, detune1, detune2, envelope) {
        this.osc = [new Oscillator(type, frequency, 0, this.gainNode = envelope)];
        detune1 != 0 && this.osc.push(new Oscillator(type, frequency, detune1, envelope));
        detune2 != 0 && this.osc.push(new Oscillator(type, frequency, detune2, envelope));
    }
    start() {
        this.osc.forEach(o => o.start());
    }
    stop(t) {
        this.osc.forEach(o => o.stop(t));
    }
    release(t0, t) {
        this.gainNode.gain.cancelScheduledValues(t0)
            .setValueAtTime(this.gainNode.gain.value, t0)
            .linearRampToValueAtTime(0, t0 + t);
        this.stop(t0 + t);
    }
    static map = new Map();
}
 
