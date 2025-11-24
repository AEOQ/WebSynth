import {A,E,O,Q} from '//aeoq.github.io/AEOQ.mjs';
import PointerInteraction from '//aeoq.github.io/pointer-interaction/script.js';

document.forms[0].oninput = ev => {
    let node = ev.target.closest('fieldset')?.name;
    if (!node || node == 'Envelope') return;
    let changed = {[ev.target.name]: ev.target.value};
    Notes.forEach(nodes => Node(nodes[node], changed));
}
const Controls = name => {
    if (Array.isArray(name))
        return new O(name.map(n => [n, Controls(n)]));
    let el = document.forms[0][name];
    return el?.tagName == 'FIELDSET' ?
        new O([...el.elements ?? []].map(({name, value}) => [name, parseFloat(value) || value])) :
        parseFloat(el?.value) || el?.value;
}
class Nodes {
    constructor(all) {
        Nodes.context();
        new O(all).each(([type, options]) => this[type] = new Node(type, options));
        return this;
    }
    connect (...ns) {
        for (let i = 1; i <= ns.length; i++) {
            if (i == ns.length) 
                return this[ns[i - 1]].connect(Nodes.ctx.destination) && this;
            if (Array.isArray(ns[i]))
                ns[i].forEach(params => this[ns[i - 1]].connect(...params.map(p => typeof p == 'string' ? this[p] : p)));
            else if (Array.isArray(ns[i - 1]))
                this[ns[i - 1][0][0]].connect(this[ns[i]]);
            else 
                this[ns[i - 1]].connect(this[ns[i]]);
        }
    }
    start () {
        this.Oscillator.start();
        Node(this.Gain, {envelope: {now: Nodes.ctx.currentTime, ...Controls(['A','D','S'])}});
        Visualizer(this.Analyser, Q('[name=visualize]').checked ? 'spectrum' : 'wave');
        return this;
    }
    stop () {
        Node(this.Gain, {envelope: {now: Nodes.ctx.currentTime, R: Controls('R')}});
        this.Oscillator.stop(Nodes.ctx.currentTime + 5);
        return this;
    }
    static context = () => (!Nodes.ctx || Nodes.ctx.state == 'closed') && (Nodes.ctx = new AudioContext());
}
const Node = function(typeORnode, options) {
    options = {
        ...options ?? {},
        ...Controls(typeof typeORnode == 'string' ? typeORnode : typeORnode.constructor.name.replace('Node', ''))
    };
    if (typeof typeORnode == 'string') 
        return new window[`${typeORnode}Node`](Nodes.ctx, options);

    Object.entries(options).forEach(([p, v]) => {
        if (p == 'envelope') {
            typeORnode.gain.cancelScheduledValues(v.now);
            v.R != null ?
                typeORnode.gain.exponentialRampToValueAtTime(0.0001, v.now + v.R) :
                typeORnode.gain.setValueAtTime(0, v.now)
                    .linearRampToValueAtTime(1, v.now + v.A)
                    .exponentialRampToValueAtTime(v.S, v.now + v.A + v.D);
        } else
            typeof v == 'object' ? Object.assign(node[p], v) :
            typeof v == 'number' ? typeORnode[p].value = v : typeORnode[p] = v;
    });
    return typeORnode;
}

const Visualizer = (analyser, type) => {
    const canvas = Q('canvas');
    Object.assign(Visualizer, {
        width: canvas.width, height: canvas.height,
        ctx: canvas.getContext('2d')
    });
    if (type) {
        Visualizer.ctx.clearRect(0, 0, Visualizer.width, Visualizer.height);
        Visualizer[type](analyser);
    }
}
Object.assign(Visualizer, {
    wave: function(analyser, data) {
        data ??= new Uint8Array(analyser.fftSize = 2048);
        requestAnimationFrame(() => this.wave(analyser, data));

        analyser.getByteTimeDomainData(data);
        this.ctx.fillStyle = E(Q('html')).get('--bg');
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "white";
        this.ctx.beginPath();
        data.forEach((d, i) => 
            this.ctx[i ? 'lineTo' : 'moveTo'](i * this.width / data.length, d / 128 * this.height / 2)
        );
        this.ctx.lineTo(this.width, this.height / 2);
        this.ctx.stroke();
    },
    spectrum: function(analyser, data) {
        analyser.fftSize = 256;
        data ??= new Uint8Array(analyser.frequencyBinCount);
        requestAnimationFrame(() => this.spectrum(analyser, data));

        analyser.getByteFrequencyData(data);
        this.ctx.fillStyle = E(Q('html')).get('--bg');
        this.ctx.fillRect(0, 0, this.width, this.height);

        const barWidth = (this.width / data.length) * 2.5;
        data.forEach((d, i) => {
            this.ctx.fillStyle = `hsl(${d + 100},80%,50%)`;
            this.ctx.fillRect(i * (barWidth + 1), this.height - d / 2, barWidth, d / 2);
        });
    }
});

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
            let button = E('button', {
                value: 1976 / Math.pow(2, i/12), 
                dataset: {
                    pitch: `${this.pitches[i % this.pitches.length]}${6 - Math.floor(i / this.pitches.length)}`
                }
            }); //B6
            this.KB.prepend(button);
        }
        PointerInteraction.events({'#keyboard': {scroll: {x: true}}});
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
        Keyboard.playEvents.forEach(type => addEventListener(type, ev => this.play(ev))); //this
    }
    play(ev) {
        if (!Keyboard.isKey(ev)) return;
        let hz = Keyboard.getHz(ev);
        hz && Notes.set(hz, new Note(hz));
        Keyboard.stopEvents.forEach(type => addEventListener(type, this.stop));
        Keyboard.clearEvents.forEach(type => addEventListener(type, this.clear));
    }
    stop(ev) {
        if (!Keyboard.isKey(ev)) return;
        let hz = Keyboard.getHz(ev);
        Notes.get(hz)?.stop();
        Notes.delete(hz);
        Notes.size || Keyboard.stopEvents.forEach(type => removeEventListener(type, this.stop));
    }
    clear() {
        Notes.forEach(note => note.stop());
        Notes = new Map();
        Keyboard.clearEvents.forEach(type => removeEventListener(type, this.clear));
    }
    static playEvents = ['pointerdown', 'keydown'];
    static stopEvents = ['pointerup', 'pointercancel', 'pointerleave', 'pointerout', 'keyup'];
    static clearEvents = ['blur']
    static isKey = ev => !ev.repeat && (ev.target.matches('#keyboard button') || ev.key && KB.keyMap[ev.key.toUpperCase()]);
    static getHz = ev => ev.type.includes('key') ? KB.keyMap[ev.key.toUpperCase()]?.value : ev.target.value;
}
let KB = new Keyboard();
let Notes = new Map();
class Note {
    constructor(hz) {
        if (!hz) return;
        Notes.get(hz)?.stop();
        Notes.delete(hz);

        Nodes.context();
        const impulseLength = Math.floor(Nodes.ctx.sampleRate * 0.05); // 50ms
        const impulse = Nodes.ctx.createBuffer(2, impulseLength, Nodes.ctx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const sampleData = impulse.getChannelData(channel);
            for (let i = 0; i < impulseLength; i++) {
                sampleData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
            }
        }
        return new Nodes({
            Oscillator: {frequency: hz},
            Gain: {gain: 0},
            BiquadFilter: {},
            IIRFilter: { 
                feedforward: new Float32Array([1]), 
                feedback: new Float32Array([-1.779, 0.817])
            },
            WaveShaper: { 
                curve: new Float32Array([...Array(101)].map((_, i) => Math.tanh(2 * (i / (101 - 1) * 2 - 1)))) 
            },
            DynamicsCompressor: {},
            Delay: {},
            Convolver: {buffer: impulse},
            ChannelSplitter: { numberOfOutputs: 2 },
            ChannelMerger: { numberOfInputs: 2 },
            Panner: {
                panningModel: 'HRTF',
                distanceModel: 'inverse',
                refDistance: 1,
                maxDistance: 10000,
                rolloffFactor: 1,
                coneInnerAngle: 360,
                coneOuterAngle: 0,
                coneOuterGain: 0,
                positionX: 1,
                positionY: 0,
                positionZ: -1
            },
            StereoPanner: {},
            Analyser: {}
        }).connect(
            'Oscillator', 'Gain', 
            'BiquadFilter', 'IIRFilter', 'WaveShaper', 'DynamicsCompressor', 
            'Delay', /*'Convolver',*/ 'ChannelSplitter', [['ChannelMerger', 0, 0],['ChannelMerger', 1, 1]], 
            /*'Panner',*/ 'StereoPanner', 'Analyser'
// Connect chain: osc → gain → biquad → iir → waveshaper → compressor → delay → convolver → splitter → merger → panner → stereoPanner → destination
        ).start();
    }
}
