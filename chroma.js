// Author:      Ryan Mitchener
// Date:        October, 2013

// Color Picker Object Constructor
function Chroma(options) {
    // Initialize user options
    this.options = (options) ? options : {};
    this.options.bound = (this.options.bound) ? this.options.bound : false;
    this.options.after = (this.options.after !== undefined) ? this.options.after : null;
    this.options.before = (this.options.before !== undefined) ? this.options.before : null;
    this.options.display = (this.options.display) ? this.options.display : "hsl";
    this.options.changeBoundValue = (this.options.changeBoundValue === false) ? false : true;
    this.options.setValueOnClose = (this.options.setValueOnClose === false) ? false : true;
    this.options.changeHue = (this.options.changeHue === false) ? false : true;
    this.options.changeWithAlpha = (this.options.changeWithAlpha === false) ? false : true;
    this.options.position = (this.options.position) ? this.options.position : ["center", "center"];

    // Set up misc variables
    this.id = Math.round(Math.random() * 10000) + ":" + Date.now();
    this.transform = (window.navigator.userAgent.match(/Chrome|Safari|iPad|iPhone|iPod/i)) ? "webkitTransform" : "transform";
    this.eventType = navigator.userAgent.match(/Android|iPad|iPhone|iPod/i) ? "touch" : "mouse";
    this.requestAnimFrame = (navigator.userAgent.match(/Safari|iPad|iPhone|iPod/i)) ? "webkitRequestAnimationFrame" : "requestAnimationFrame";

    // Construct the color picker
    this.construct();

    // Set up canvases
    this.preview = new ChromaHandler(this.picker.querySelector('.chroma-preview'), "preview", 0, 0, this.translate);
    this.hue = new ChromaHandler(this.picker.querySelector('.chroma-hue'), "hue", 0, 360, this.translate);
    this.satLight = new ChromaHandler(this.picker.querySelector('.chroma-sat-light'), "sat-light", null, 100, this.translate);
    this.alpha = new ChromaHandler(this.picker.querySelector('.chroma-alpha'), "alpha", 1, 1, this.translate);
    this.multiplier = 359 / this.hue.canvas.width;

    // Set-up bound element
    if (this.options.bound !== false) {
        // Set up initial values if they exist
        if (this.options.bound.tagName === "INPUT") {
            this.options.bound.addEventListener('change', this.parseInputValue.bind(this, this.options.bound));
            this.options.bound.addEventListener('keydown', this.show.bind(this));
            if (this.options.bound.value !== "") {
                this.parseInputValue(this.options.bound);
            }
        } else if (this.options.bound.dataset.value !== "") {
            this.parseInputValue(this.options.bound);
        }

        // Attach show/hide event listeners
        this.options.bound.addEventListener('mousedown', this.show.bind(this));
        this.picker.addEventListener('keydown', this.show.bind(this));

        // Attach cancel propagation event for click hiding
        var type = (this.eventType) === "mouse" ? "mousedown" : "touchstart";
        this.picker.addEventListener(type, function(ev) { ev.stopPropagation(); });
        window.addEventListener(type, this.hide.bind(this));
    }

    // Attach dragging events
    var type = (this.eventType === "mouse") ? 'mousedown' : 'touchstart';
    this.hue.container.addEventListener(type, this.HandlePointerDown.bind(this, this.hue));
    this.satLight.container.addEventListener(type, this.HandlePointerDown.bind(this, this.satLight));
    this.alpha.container.addEventListener(type, this.HandlePointerDown.bind(this, this.alpha));

    // Allow clicking on the canvas to set value
    this.preview.canvas.addEventListener(type, this.changeDisplayType.bind(this));
    this.hue.canvas.addEventListener(type, this.valueChange.bind(this, this.hue));
    this.satLight.canvas.addEventListener(type, this.valueChange.bind(this, this.satLight));
    this.alpha.canvas.addEventListener(type, this.valueChange.bind(this, this.alpha));

    // Handle user typing into the value input
    this.valuesInput.addEventListener('input', this.parseInputValue.bind(this, this.valuesInput));

    // Attach remaining events based on user agent
    if (this.eventType === "mouse") {
        // Window events
        window.addEventListener('mousemove', this.HandlePointerMove.bind(this));
        window.addEventListener('mouseup', this.HandlePointerUp.bind(this));

        // Add mousewheel events for canvases
        this.hue.container.addEventListener('mousewheel', this.HandleCanvasScroll.bind(this, this.hue));
        this.satLight.container.addEventListener('mousewheel', this.HandleCanvasScroll.bind(this, this.satLight));
        this.alpha.container.addEventListener('mousewheel', this.HandleCanvasScroll.bind(this, this.alpha));

        // Input event listeners
        this.valuesInput.addEventListener('keydown', this.changeInputValue.bind(this));
        this.valuesInput.addEventListener('mousewheel', this.changeInputValue.bind(this));
    } else {
        // Window events
        window.addEventListener('touchmove', this.HandlePointerMove.bind(this));
        window.addEventListener('touchend', this.HandlePointerUp.bind(this));
    }

    // Draw initial canvases
    this.draw(null, true);
}


// Color Picker Handler Constructor
function ChromaHandler(canvas, type, value, max, translate) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.container = canvas.parentElement;
    this.canvas = canvas;
    this.clientWidth = this.canvas.clientWidth;
    this.clientHeight = this.canvas.clientHeight;
    this.offsetWidth = this.canvas.offsetWidth;
    this.offsetHeight = this.canvas.offsetHeight;
    this.ctx = canvas.getContext('2d');
    this.max = max || 0;
    this.handle = canvas.parentElement.querySelector('.chroma-handle');
    this.type = type;

    if (this.handle) {
        this.handleWidth = this.handle.offsetWidth;
        this.handleHeight = this.handle.offsetHeight;
    }

    if (type === "sat-light") {
        this.value = [100, 50];
    } else {
        this.value = (value !== undefined) ? value : 0;
    }

    this.x1 = translate[0];
    this.y1 = translate[1];

    var offset = canvas;
    while (offset !== null) {
        this.x1 += offset.offsetLeft;
        this.y1 += offset.offsetTop;
        offset = offset.offsetParent;
    }
    this.x2 = this.x1 + canvas.clientWidth;
    this.y2 = this.y1 + canvas.clientHeight;
}


// Constructs the color picker
Chroma.prototype.construct = function() {
    this.picker = document.createElement('div');
    this.picker.classList.add('chroma');
    this.picker.setAttribute('data-id', this.id);

    if (this.options.id) {
        this.picker.id = this.options.id;
    }
    if (this.options.class) {
        this.picker.className += " "+this.options.class;
    }
    if (this.options.bound !== false) {
        this.picker.classList.add('bound');
    }

    this.valuesInput = document.createElement('input');
    this.valuesInput.classList.add('chroma-values');
    this.valuesInput.setAttribute('required', 'true');
    this.valuesInput.spellcheck = false;
    // Set regex pattern
    // Remember to double-escape all forward slashes
    var hslPattern = "hsl\\(([0-9]{1,2}|[0-2][0-9]{2,2}|3[0-5][0-9]|360),(\\s*)?([0-9]{1,2}|100)%,(\\s*)?([0-9]{1,2}|100)%\\)";
    var hslaPattern = "hsla\\(([0-9]{1,2}|[0-2][0-9]{2,2}|3[0-5][0-9]|360),(\\s*)?([0-9]{1,2}|100)%,(\\s*)?([0-9]{1,2}|100)%,(\\s*)?(0|1(\\.0{1,2})?|0?\\.[0-9]{1,2})\\)";
    var rgbPattern = "rgb\\(([0-9]{1,2}|[0-1][0-9]{1,2}|2[0-4][0-9]|[0-2][0-5]{2,2}),(\\s*)?([0-9]{1,2}|[0-1][0-9]{1,2}|2[0-4][0-9]|[0-2][0-5]{2,2}),(\\s*)?([0-9]{1,2}|[0-1][0-9]{1,2}|2[0-4][0-9]|[0-2][0-5]{2,2})\\)";
    var rgbaPattern = "rgba\\(([0-9]{1,2}|[0-1][0-9]{1,2}|2[0-4][0-9]|[0-2][0-5]{2,2}),(\\s*)?([0-9]{1,2}|[0-1][0-9]{1,2}|2[0-4][0-9]|[0-2][0-5]{2,2}),(\\s*)?([0-9]{1,2}|[0-1][0-9]{1,2}|2[0-4][0-9]|[0-2][0-5]{2,2}),(\\s*)?(0|1(\\.0{1,2})?|0?\\.[0-9]{1,2})\\)";
    var hexPattern = "#[0-9a-fA-F]{6,6}";
    this.valuesInput.pattern = "(" + hslPattern + "|" + hslaPattern + "|" + rgbPattern + "|" + rgbaPattern + "|" + hexPattern + ")";
    this.changeDisplayType();

    // Create preview/values
    var cont = document.createElement('div');
    cont.classList.add('chroma-cont');
    var canvas = document.createElement('canvas');
    canvas.className = "chroma-preview alpha-bg";
    cont.appendChild(canvas);
    cont.appendChild(this.valuesInput);
    this.picker.appendChild(cont);

    // Create saturation/light canvas
    var cont = document.createElement('div');
    cont.classList.add('chroma-cont');
    var bg = document.createElement('div');
    bg.className = 'chroma-sat-light-bg alpha-bg';
    var canvas = document.createElement('canvas');
    canvas.className = "chroma-sat-light";
    var handle = document.createElement('div');
    handle.classList.add('chroma-handle');
    cont.appendChild(bg);
    cont.appendChild(canvas);
    cont.appendChild(handle);
    this.picker.appendChild(cont);

    // Create hue canvas
    var cont = document.createElement('div');
    cont.classList.add('chroma-cont');
    var canvas = document.createElement('canvas');
    canvas.className = "chroma-hue alpha-bg";
    var handle = document.createElement('div');
    handle.classList.add('chroma-handle');
    cont.appendChild(canvas);
    cont.appendChild(handle);
    this.picker.appendChild(cont);

    // Create alpha canvas
    var cont = document.createElement('div');
    cont.classList.add('chroma-cont');
    var canvas = document.createElement('canvas');
    canvas.className = "chroma-alpha alpha-bg";
    var handle = document.createElement('div');
    handle.classList.add('chroma-handle');
    cont.appendChild(canvas);
    cont.appendChild(handle);
    this.picker.appendChild(cont);

    // Attach picker to DOM
    if (this.options.before !== null) {
        this.options.before.parentElement.insertBefore(this.picker, this.options.before);
    } else if (this.options.after !== null) {
        this.options.after.parentElement.insertBefore(this.picker, this.options.after.nextElementSibling);
    } else if (this.options.bound !== false) {
        this.options.bound.parentElement.insertBefore(this.picker, this.options.bound.nextElementSibling);
    } else {
        document.body.appendChild(this.picker);
    }

    // Position Chroma if the option is set to true
    if (this.options.bound) {
        // Get offsets
        var boundOffset = this.getTotalOffset(this.options.bound);
        var pickerOffset = this.getTotalOffset(this.picker);
        var offsetX = boundOffset[0] - pickerOffset[0];
        var offsetY = boundOffset[1] - pickerOffset[1];
        
        // Set up position
        var position = this.options.position.split(" ");
        position = (position.length === 1) ? ["center", "center"] : position;
        var centerLeft = (this.options.bound.offsetWidth/2) - (this.picker.offsetWidth/2) + offsetX;
        var centerTop = (this.options.bound.offsetHeight/2) - (this.picker.offsetHeight/2) + offsetY;

        if (position[0] === "center") {
            var left = centerLeft;
        } else if (position[0] === "left") {
            var left = offsetX;
        } else if (position[0] === "right") {
            var left = offsetX + (this.options.bound.offsetWidth - this.picker.offsetWidth);
        }

        if (position[1] === "center") {
            var top = centerTop;
        } else if (position[1] === "top") {
            var top = offsetY - this.picker.offsetHeight;
        } else if (position[1] === "bottom") {
            var top = this.options.bound.offsetHeight + offsetY;
        }        

        // Set translate value
        this.translate = [Math.round(left), Math.round(top)];

        // Create new styling based on centering transform with scale
        var style = document.createElement("style");
        style.innerHTML = '' +
            '[data-id="' + this.id + '"].chroma.bound { ' +
                '-webkit-transform: translate('+Math.round(centerLeft)+'px, '+Math.round(centerTop)+'px) scale(.2);' +
                'transform: translate('+Math.round(centerLeft)+'px, '+Math.round(centerTop)+'px) scale(.2);' +
            '}' +
            '[data-id="' + this.id + '"].chroma.bound.chroma-active {' +
                '-webkit-transform: translate('+Math.round(left)+'px, '+Math.round(top)+'px) scale(1);' +
                'transform: translate('+Math.round(left)+'px, '+Math.round(top)+'px) scale(1);' +
            '}';
        document.head.appendChild(style);
    } else {
        this.translate = [0, 0];
    }
};


// Gets the total offset value of an element
Chroma.prototype.getTotalOffset = function(element) {
    var matrix = getComputedStyle(element)[this.transform].replace(/[^\d\,\.]/gi, '').split(',');
    var offsetElement = element;
    var offsetLeft = (matrix.length > 1) ? parseInt(matrix[matrix.length - 2]) : 0;
    var offsetTop = (matrix.length > 1) ? parseInt(matrix[matrix.length - 1]) : 0;
    
    while (offsetElement) {
        offsetLeft += offsetElement.offsetLeft;
        offsetTop += offsetElement.offsetTop;
        offsetElement = offsetElement.offsetParent;
    }
    return [offsetLeft, offsetTop];
};


// Parse input element values for bound element and values input
Chroma.prototype.parseInputValue = function(element) {
    if (element.tagName === "INPUT" && (!element.checkValidity() || element.value.length === 0)) {
        return;
    }
    var value = (element.tagName === "INPUT") ? element.value : element.dataset.value;
    var matches = [];
    
    if (value.indexOf('#') !== -1) {
        this.options.display = "hex";
        var rgb = this.hexToRgb(value);
        var hsl = this.rgbToHsl(rgb[0], rgb[1], rgb[2]);
    } else if (value.indexOf('rgb') !== -1) {
        this.options.display = "rgb";
        var pattern = new RegExp(/[\d\.]+/g);
        while ((match = pattern.exec(value)) !== null) {
            matches.push(match);
        }
        var alpha = (matches[3] !== undefined) ? matches[3][0] : 1;
        var hsl = this.rgbToHsl(matches[0][0], matches[1][0], matches[2][0], alpha);
    } else {
        this.options.display = "hsl";
        var pattern = new RegExp(/[\d\.]+/g);
        while ((match = pattern.exec(value)) !== null) {
            matches.push(match);
        }
        var alpha = (matches[3] !== undefined) ? matches[3][0] : 1;
        var hsl = [matches[0][0], matches[1][0], matches[2][0], alpha];
    }

    // Make sure things are within boundries
    hsl[0] = (hsl[0] <= 360) ? hsl[0] : 360;
    hsl[0] = (hsl[0] >= 0) ? hsl[0] : 0;
    hsl[1] = (hsl[1] <= 100) ? hsl[1] : 100;
    hsl[1] = (hsl[1] >= 0) ? hsl[1] : 0;
    hsl[2] = (hsl[2] <= 100) ? hsl[2] : 100;
    hsl[2] = (hsl[2] >= 0) ? hsl[2] : 0;
    hsl[3] = (hsl[3] <= 1) ? hsl[3] : 1;
    hsl[3] = (hsl[3] >= 0) ? hsl[3] : 0;

    this.hue.value = hsl[0];
    this.satLight.value[0] = hsl[1];
    this.satLight.value[1] = hsl[2];
    this.alpha.value = hsl[3];

    this.draw();
};


// Changes display type
Chroma.prototype.changeDisplayType = function(ev) {
    if (ev) {
        if (this.options.display === "hsl") {
            this.options.display = "rgb";
        } else if (this.options.display === "rgb") {
            this.options.display = "hex";
        } else {
            this.options.display = "hsl";
        }
    }

    // Draw preview if canvas was clicked on
    if (ev) {
        this.drawValues();
    }
};


// Shows or hides the color picker
Chroma.prototype.show = function(ev) {
    ev.stopPropagation();
    if (ev.type === "keydown") {
        if (ev.which === 13) { 
            // Enter button
            this.picker.classList.add('chroma-active');
            this.setResetValue();
        } else if (ev.which === 27) {
            // Escape button
            this.picker.classList.remove('chroma-active');

            // Reset values on cancel
            this.hue.value = this.options.bound.dataset.hue;
            this.satLight.value[0] = this.options.bound.dataset.saturation;
            this.satLight.value[1] = this.options.bound.dataset.lightness;
            this.alpha.value = this.options.bound.dataset.alpha;
            this.draw();
        }
    } else {
        if (ev.button === 2) {
            return;
        } else if (!this.picker.classList.contains('chroma-active')) {
            this.picker.classList.add('chroma-active');
            this.setResetValue();
        } else if (ev.target !== this.options.bound) {
            this.hide();
        }
    }
};


// Set current values so if value is canceled with the escape button we can reset
Chroma.prototype.setResetValue = function() {
    this.options.bound.dataset.hue = this.hue.value;
    this.options.bound.dataset.saturation = this.satLight.value[0];
    this.options.bound.dataset.lightness = this.satLight.value[1];
    this.options.bound.dataset.alpha = this.alpha.value;
}


// Explicitly hides the picker if the user clicks off of it
Chroma.prototype.hide = function() {
    if (this.picker.classList.contains('chroma-active')) {
        this.picker.classList.remove('chroma-active');
        if (this.options.setValueOnClose) {
            this.drawValues(true);
        }
    }
};


// Handles pointer down event for hue, saturation/lightness, and alpha canvases
Chroma.prototype.HandlePointerDown = function(object, ev) {
    if (ev.type === "touchstart") {
        ev.preventDefault();
        ev = ev.touches[0];
    } else if (ev.which !== 1) {
        return;
    }
    object.pointerDown = true;
};


// Handles pointer move event for hue, saturation/lightness, and alpha canvases (attached to window)
Chroma.prototype.HandlePointerMove = function(ev) {
    if (ev.type == "touchmove") {
        if (this.hue.pointerDown || this.satLight.pointerDown || this.alpha.pointerDown) {
            ev.preventDefault();
            ev = ev.touches[0];
        }
    }

    if (this.hue.pointerDown) {
        this.valueChange(this.hue, ev);
    } else if (this.satLight.pointerDown) {
        this.valueChange(this.satLight, ev);
    } else if (this.alpha.pointerDown) {
        this.valueChange(this.alpha, ev);
    }
};


// Handles pointer move event for hue, saturation/lightness, and alpha canvases
Chroma.prototype.HandlePointerUp = function(ev) {
    this.hue.pointerDown = false;
    this.satLight.pointerDown = false;
    this.alpha.pointerDown = false;
};


// Sets the value based on pointer move or pointer down events for canvases
Chroma.prototype.valueChange = function(object, ev) {
    if (ev.type === "touchstart") {
        ev.preventDefault();
        ev = ev.touches[0];
    } else if (ev.type === "mousedown" && ev.which !== 1) {
        return;
    }
    var offsetX = ev.pageX - object.x1;
    var offsetY = object.y2 - ev.pageY;
    if (object.type === "hue") {
        object.value = Math.round(offsetX * this.multiplier);
    } else if (object.type === "alpha") {
        object.value = Math.round((offsetX / this.alpha.canvas.width)*100) / 100;
    } else {
        object.value[0] = Math.round((offsetX / this.satLight.canvas.width) * 100);
        object.value[1] = Math.round((offsetY / this.satLight.canvas.height) * 100);
    }
    if (typeof object.value === "object") {
        for (var i=0, l=object.value.length; i < l; i++) {
            object.value[i] = (object.value[i] > object.max) ? object.max : object.value[i];        
            object.value[i] = (object.value[i] < 0) ? 0 : object.value[i];
        }
    } else {
        object.value = (object.value > object.max) ? object.max : object.value;
        object.value = (object.value < 0) ? 0 : object.value;
    }
    this.draw(object);
};


// Draws all canvases
Chroma.prototype.draw = function(object, initialDraw) {
    window[this.requestAnimFrame](this.drawPreview.bind(this, this.preview));
    window[this.requestAnimFrame](this.drawValues.bind(this));
    if (object !== this.hue && (initialDraw || this.options.changeHue)) {
        window[this.requestAnimFrame](this.drawHueAlpha.bind(this, this.hue));
    }
    if (object !== this.satLight) {
        window[this.requestAnimFrame](this.drawSatLight.bind(this, this.hue.value));
    }
    if (object !== this.alpha) {
        window[this.requestAnimFrame](this.drawHueAlpha.bind(this, this.alpha));    
    }
    window[this.requestAnimFrame](this.translateHandle.bind(this, this.hue));
    window[this.requestAnimFrame](this.translateHandle.bind(this, this.satLight));
    window[this.requestAnimFrame](this.translateHandle.bind(this, this.alpha));

    if (this.onChange) {
        var rgba = this.hslToRgb(this.hue.value, this.satLight.value[0], this.satLight.value[1], this.alpha.value);
        var hex = this.rgbToHex(rgba[0], rgba[1], rgba[2]);
        var event = {
            hsla: [this.hue.value, this.satLight.value[0], this.satLight.value[1], this.alpha.value],
            rgba: rgba,
            hex: hex
        };
        this.onChange.call(event);
    }
};


// Draws values in input box
Chroma.prototype.drawValues = function(setBoundValue) {
    var cursor = this.valuesInput.selectionStart;
    var value;

    if (this.options.display === "hsl") {
        value = "hsla("+this.hue.value+", "+this.satLight.value[0]+"%, "+this.satLight.value[1]+"%, "+this.alpha.value+")";
    } else if (this.options.display === "rgb") {
        var rgb = this.hslToRgb(this.hue.value, this.satLight.value[0], this.satLight.value[1]);
        value = "rgba("+rgb[0]+", "+rgb[1]+", "+rgb[2]+", "+this.alpha.value+")";
    } else if (this.options.display === "hex") {
        var rgb = this.hslToRgb(this.hue.value, this.satLight.value[0], this.satLight.value[1]);
        var hex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
        value = hex;
    }

    if (this.options.bound && this.options.bound.tagName === "INPUT") {
        if (setBoundValue === true && this.options.changeBoundValue) {
            this.options.bound.value = value;
        } else if (!this.options.setValueOnClose && this.options.changeBoundValue) {
            this.options.bound.value = value;
        }
    }

    this.valuesInput.value = value;
    this.valuesInput.selectionStart = cursor;
    this.valuesInput.selectionEnd = cursor;
};


// Draws the preview canvas
Chroma.prototype.drawPreview = function(object) {
    var valueString = "hsla("+this.hue.value+", "+this.satLight.value[0]+"%, "+this.satLight.value[1]+"%, "+this.alpha.value+")";
    object.ctx.clearRect(0, 0, object.canvas.width, object.canvas.height);
    object.ctx.fillStyle = valueString;
    object.ctx.fillRect(0, 0, object.canvas.width, object.canvas.height);
};


// Draws hue and alpha canvases
Chroma.prototype.drawHueAlpha = function(object) {
    object.ctx.clearRect(0, 0, object.clientWidth, object.clientHeight);
    var gradient = object.ctx.createLinearGradient(0, 0, object.clientWidth, 0);
    for (var i=0; i <= 6; i+=1) {
        if (object.type === "hue") {
            if (this.options.changeHue) {
                gradient.addColorStop(i/6, 'hsla(' + i*(360/6) + ', ' + this.satLight.value[0] + '%, ' + this.satLight.value[1] + '%, ' + this.alpha.value + ')');
            } else {
                gradient.addColorStop(i/6, 'hsla(' + i*(360/6) + ', 100%, 50%, 1)');
            }
        } else if (object.type === "alpha") {
            gradient.addColorStop(i/6, 'hsla(' + this.hue.value + ', ' + this.satLight.value[0] + '%, ' +this.satLight.value[1] + '%, ' + i/6 + ')');
        }
    }
    object.ctx.fillStyle = gradient;
    object.ctx.fillRect(0, 0, object.clientWidth, object.clientHeight);
};


// Renders the saturation and lightness canvas
Chroma.prototype.drawSatLight = function(hue) {
    var width = this.satLight.clientWidth;
    var height = this.satLight.clientHeight;
    var ctx = this.satLight.ctx;

    ctx.clearRect(0, 0, width, height);
    var grd;
    
    // Draw alpha gradient from left to right
    grd = ctx.createLinearGradient(0, 0, width, 0);
    grd.addColorStop(0, "hsla(0,0%,0%,1)");
    grd.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    // Next thing will only change color and leave alpha alone
    ctx.globalCompositeOperation = 'source-in';

    // Draw grayscale gradient from up to down
    grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, "hsla("+hue+", 0%, 100%, 1)");
    grd.addColorStop(0.5, "hsla("+hue+", 0%, 50%, 1)");
    grd.addColorStop(1, "hsla("+hue+", 0%, 0%, 1)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    
    // Next thing will draw underneath everything
    ctx.globalCompositeOperation = 'destination-over';
    
    // Draw fully saturated gradient from up to down
    grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, "hsla("+hue+", 100%, 100%, 1)");
    grd.addColorStop(0.5, "hsla("+hue+", 100%, 50%, 1)");
    grd.addColorStop(1, "hsla("+hue+", 100%, 0%, 1)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    
    // Reset compositing mode
    ctx.globalCompositeOperation = 'source-over';
    if (this.options.changeWithAlpha) {
        this.satLight.canvas.style.opacity = this.alpha.value;        
    }
};


// Moves the canvas handle based on the value of an object
Chroma.prototype.translateHandle = function(object) {
    if (object.type === "hue") {
        var value = (object.value / 360) * 100;
    } else if (object.type === "alpha") {
        var value = (object.value * 100);
    } else {
        var value = object.value[0];
    }
    var translateY = 0;
    var handleOffsetX = value / 100*object.handleWidth;
    var translateX = (value * (object.offsetWidth / 100)) - handleOffsetX;
    if (object.type === "sat-light") {
        var handleOffsetY = (100 - object.value[1]) / 100*object.handleHeight;
        var translateY = (100 - object.value[1] * (object.offsetHeight / 100)) - handleOffsetY;
    }
    object.handle.style[this.transform] = "translate3d(" + translateX + "px, " + translateY + "px, 0px)";
};


// Changes the input's values. Fired by keydown and mousewheel on the input
Chroma.prototype.changeInputValue = function(ev) {
    if (this.options.display !== "hsl") {
        return;
    }

    if (ev.type === "mousewheel") {
        var direction = (ev.wheelDelta > 0) ? "up" : "down";
    } else if (ev.which !== 40 && ev.which !== 38) {
        return;
    } else {
        var direction = (ev.which === 38) ? "up" : "down";
    }
    var multiplier = (ev.shiftKey) ? 10 : 1;
    ev.preventDefault();

    var cursor = this.valuesInput.selectionStart;
    var pattern = new RegExp(/[\d\.]+/gi);
    var matches = [];
    while ((match = pattern.exec(this.valuesInput.value)) !== null) {
        matches.push(match);
    }
    for (var i=0, l=matches.length; i < l; i++) {
        if (cursor >= matches[i].index) {
            if (matches[i+1] === undefined) {
                var index = i;
                break;
            } else if (cursor < matches[i+1].index) {
                var index = i;
                break;
            }
        }
    }
    index = index || 0;
    var value = (index !== 3) ? parseInt(matches[index][0]) : parseFloat(matches[index][0]);

    if (index === 0) {
        value = (direction === "up") ? value + (1 * multiplier) : value - (1 * multiplier);
        value = (value > 360) ? 360 : value;
        var object = this.hue;
    } else if (index === 1 || index === 2) {
        value = (direction === "up") ? value + (1 * multiplier) : value - (1 * multiplier);
        value = (value > 100) ? 100 : value;
        var object = this.satLight;
    } else if (index === 3) {
        value = (direction === "up") ? (value + (.01 * multiplier)).toFixed(2) : (value - (.01 * multiplier)).toFixed(2);
        value = (value > 1) ? 1 : value;
        var object = this.alpha;
    }
    value = (value < 0) ? 0 : value;
    matches[index][0] = value;

    this.hue.value = matches[0][0];
    this.satLight.value[0] = matches[1][0];
    this.satLight.value[1] = matches[2][0];
    this.alpha.value = matches[3][0];
    this.draw(object);
};


// Handles mousewheel on a canvas
Chroma.prototype.HandleCanvasScroll = function(object, e) {
    var direction = (e.wheelDelta > 0) ? "up" : "down";
    var multiplier = (e.shiftKey) ? 10 : 1;
    if (object.type === "alpha") {
        object.value = parseFloat(object.value);
        if (direction === "up") {
            object.value = (object.value + .01*multiplier).toFixed(2);
        } else {
            object.value = (object.value - .01*multiplier).toFixed(2);
        }
        object.value = (object.value > 1) ? 1 : object.value;
        object.value = (object.value < 0) ? 0 : object.value;
    } else if (object.type === "hue") {
        object.value = (direction === "up") ? object.value + 1*multiplier : object.value - 1*multiplier;
        object.value = (object.value > 360) ? 360 : object.value;
        object.value = (object.value < 0) ? 0 : object.value;
    } else {
        var index;
        if (e.altKey) {
            index = 0;
            object.value[0] = (direction === "up") ? object.value[0] + 1*multiplier : object.value[0] - 1*multiplier;
        } else {
            index = 1;
            object.value[1] = (direction === "up") ? object.value[1] + 1*multiplier : object.value[1] - 1*multiplier;
        }
        object.value[index] = (object.value[index] > 100) ? 100 : object.value[index];
        object.value[index] = (object.value[index] < 0) ? 0 : object.value[index];
    }

    this.draw(object);
};


// Converts RGB to Hex
Chroma.prototype.rgbToHex = function(r, g, b) {
    r = (r >= 16) ? r.toString(16) : "0" + r.toString(16);
    g = (g >= 16) ? g.toString(16) : "0" + g.toString(16);
    b = (b >= 16) ? b.toString(16) : "0" + b.toString(16);
    return ("#"+r+g+b).toUpperCase();
};

// Converts Hex to rgb
Chroma.prototype.hexToRgb = function(hex, a) {
    var pattern = new RegExp(/[0-9a-fA-F]{2,2}/gi);
    var matches = [];
    while ((match = pattern.exec(hex)) !== null) {
        matches.push(match);
    }
    return [parseInt(matches[0][0], 16), parseInt(matches[1][0], 16), parseInt(matches[2][0], 16), a];
};

// Converts HSL to RGB
Chroma.prototype.hslToRgb = function(h, s, l, a) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    var m2 = (l<=0.5) ? l*(s+1) : l+s-l*s;
    var m1 = l*2-m2;
    var r = this.getHueRGB(m1, m2, h+1/3);
    var g = this.getHueRGB(m1, m2, h);
    var b = this.getHueRGB(m1, m2, h-1/3);
    var multiplier = (255/100)*100;

    return [Math.round(r*multiplier), Math.round(g*multiplier), Math.round(b*multiplier), a];
};

// Gets RGB hue
Chroma.prototype.getHueRGB = function(m1, m2, h) {
    if (h < 0) {
        h+=1;
    }
    if (h > 1) {
        h-=1;
    } 
    if (h*6 < 1) {
        return m1+(m2-m1)*h*6;
    } else if (h*2 < 1) {
        return m2;
    } else if (h*3 < 2) {
        return m1+(m2-m1)*(2/3-h)*6;
    }
    return m1;
};

// Get HSL value from rgb
Chroma.prototype.rgbToHsl = function(r, g, b, a) {
    var r = r/255;
    var g = g/255;
    var b = b/255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    var h, s, l;

    if (delta === 0) {
        h = 0;
    } else if (max === r) {
        h = ((g - b)/delta) % 6;
    } else if (max === g) {
        h = ((b - r)/delta) + 2;
    } else if (max === b) {
        h = ((r - g)/delta) + 4;
    }

    h *= 60;
    h = (h < 0) ? h + 360 : h;
    l = (max + min) / 2;
    s = (delta === 0) ? 0 : delta / (1 - Math.abs(2 * l - 1));
    
    return [Math.round(h), Math.round(s*100), Math.round(l*100), a];
};