import {A,E,O,Q} from '//aeoq.github.io/AEOQ.mjs';
import PointerInteraction from '//aeoq.github.io/pointer-interaction/script.js';

addEventListener('contextmenu', ev => ev.preventDefault());
document.forms[0].oninput = ev => {
    let node = ev.target.closest('fieldset')?.name;
    if (!node || node == 'Envelope') return;
    let changed = {[ev.target.name]: ev.target.value};
    Notes.forEach(nodes => Node(nodes[node], changed));
}
const Controls = {get: name => {
    if (Array.isArray(name))
        return new O(name.map(n => [n, Controls.get(n)]));
    let el = document.forms[0][name];
    return el?.tagName == 'FIELDSET' ?
        new O([...el.elements ?? []].map(({name, value}) => [name, parseFloat(value) || value])) :
        parseFloat(el?.value) || el?.value;
}}

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
        Node(this.Gain, {envelope: {now: Nodes.ctx.currentTime, ...Controls.get(['A','D','S'])}});
        Visualizer(this.Analyser, Q('[name=visualize]').checked ? 'spectrum' : 'wave');
        return this;
    }
    stop () {
        Node(this.Gain, {envelope: {now: Nodes.ctx.currentTime, R: Controls.get('R')}});
        this.Oscillator.stop(Nodes.ctx.currentTime + 5);
        return this;
    }
    static context = () => (!Nodes.ctx || Nodes.ctx.state == 'closed') && (Nodes.ctx = new AudioContext());
}
const Node = function(typeORnode, options) {
    options = {
        ...options ?? {},
        ...Controls.get(typeof typeORnode == 'string' ? typeORnode : typeORnode.constructor.name.replace('Node', ''))
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

class Keyboard {
    constructor() {
        this.KB = Q('#keyboard');
        this.setup();
        this.events();
    }
    pitches = ['B','B♭','A','A♭','G','G♭','F','E','E♭','D','D♭','C']
    keys = [
        ['Y','7','U','8','I','O','0','P','-','[','=',']'],
        ['Z','S','X','D','C','V','G','B','H','N','J','M'],
    ]
    keyMap = {}
    setup() {
        for (let i = 0; i < 60; i++) {
            this.KB.prepend(E('button', {
                id: `${this.pitches[i % this.pitches.length]}${6 - Math.floor(i / this.pitches.length)}`,
                value: 1976 / Math.pow(2, i/12)
            })); //B6
        }
    }
    events() {
        PointerInteraction.events({'#keyboard': {scroll: {x: true}}});
        const distanceToMid = C => Math.abs(C.offsetLeft + C.clientWidth/2 - this.KB.scrollLeft - innerWidth/2);
        (this.KB.onscroll = () => {
            let keyC = this.KB.Q('[id^=C]').reduce((min, c) => distanceToMid(c) < distanceToMid(min) ? c : min);
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
        this.playEvents.forEach(type => addEventListener(type, ev => this.play(ev))); //this
    }
    play(ev) {
        if (!this.isKey(ev)) return;
        let hz = this.getHz(ev);
        hz && Notes.set(hz, new Note(hz));
        this.stopEvents.forEach(type => addEventListener(type, ev => this.stop(ev)));
        this.clearEvents.forEach(type => addEventListener(type, this.clear));
    }
    stop(ev) {
        if (!this.isKey(ev)) return;
        let hz = this.getHz(ev);
        Notes.get(hz)?.stop();
        Notes.delete(hz);
        Notes.size || this.stopEvents.forEach(type => removeEventListener(type, this.stop));
    }
    clear() {
        Notes.forEach(note => note.stop());
        Notes = new Map();
        this.clearEvents.forEach(type => removeEventListener(type, this.clear));
    }
    playEvents = ['pointerdown', 'keydown'];
    stopEvents = ['pointerup', 'pointercancel', 'pointerleave', 'pointerout', 'keyup'];
    clearEvents = ['blur']
    isKey = ev => !ev.repeat && (ev.target.matches('#keyboard button') || ev.key && KB.keyMap[ev.key.toUpperCase()]);
    getHz = ev => ev.type.includes('key') ? KB.keyMap[ev.key.toUpperCase()]?.value : ev.target.value;
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

const Visualizer = (analyser, type) => {
    const canvas = Q('canvas');
    Object.assign(Visualizer, {
        width: canvas.width, height: canvas.height,
        ctx: canvas.getContext('2d')
    });
    if (type) {
        Visualizer.ctx.clearRect(0, 0, canvas.width, canvas.height);
        Visualizer[type](analyser);
        Visualizer.ctx.lineWidth = 2;
        Visualizer.ctx.strokeStyle = "white";
    }
}
Object.assign(Visualizer, {
    clear: function() {
        this.ctx.fillStyle = E(Q('html')).get('--bg');
        this.ctx.fillRect(0, 0, this.width, this.height);
    },
    wave: function(analyser, data) {
        data ??= new Uint8Array(analyser.fftSize = 2048);
        this.timer = requestAnimationFrame(() => this.wave(analyser, data));

        analyser.getByteTimeDomainData(data);
        this.clear();
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
        this.timer = requestAnimationFrame(() => this.spectrum(analyser, data));

        analyser.getByteFrequencyData(data);
        this.clear();
        const barWidth = (this.width / data.length) * 2.5;
        data.forEach((d, i) => {
            this.ctx.fillStyle = `hsl(${d + 100},80%,50%)`;
            this.ctx.fillRect(i * (barWidth + 1), this.height - d / 2, barWidth, d / 2);
        });
    }
});