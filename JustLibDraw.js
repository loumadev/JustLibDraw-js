
/*!
 * JustLibDraw JavaScript Library v0.0.1
 * Rendering Canvas addon for JustLib Library
 *
 * Copyright 2019-2022
 * Date: 2019-06-16T13:01Z
 */


/**
 * @typedef {import('./JustLib.js').JL} JL
 */

/**
 * @typedef {import('./JustLib.js').Vector} Vector
 */

/**
 * @typedef {import('./JustLib.js').Matrix} Matrix
 */


var canvas, ctx,
	Height, Width,
	CENTER, FPS = 60,
	Frames = 0,
	fpsTime = 0,
	FRAMERATE = 60,
	CANVASES = {
		length: 0
	};

var gl = WebGLRenderingContext;

const CONTEXT_2D = CanvasRenderingContext2D;
const CONTEXT_WEBGL = WebGLRenderingContext;


const PROJECTION_ORTHOGRAPHIC = new Matrix([
	[1, 0, 0],
	[0, 1, 0]
]);

const Project = {
	orth: function(matrix) {
		var p = PROJECTION_ORTHOGRAPHIC.mult(matrix);
		return new Vector(p.matrix[0][0], p.matrix[1][0]);
	},
	pers: function(matrix, mult, depth = 3) {
		var z = 1 / (depth - matrix.matrix[2][0]);

		matrix = matrix.mult(mult);

		var p = new Matrix([
			[z, 0, 0],
			[0, z, 0]
		]).mult(matrix);

		return new Vector(p.matrix[0][0], p.matrix[1][0]);
	}
};

const Rotate3D = {
	x: function(matrix, angle) {
		return new Matrix([
			[1, 0, 0, 0],
			[0, Math.cos(angle), -Math.sin(angle), 0],
			[0, Math.sin(angle), Math.cos(angle), 0],
			[0, 0, 0, 1]
		]).mult(matrix);
	},
	y: function(matrix, angle) {
		return new Matrix([
			[Math.cos(angle), 0, Math.sin(angle), 0],
			[0, 1, 0, 0],
			[-Math.sin(angle), 0, Math.cos(angle), 0],
			[0, 0, 0, 1]
		]).mult(matrix);
	},
	z: function(matrix, angle) {
		return new Matrix([
			[Math.cos(angle), -Math.sin(angle), 0, 0],
			[Math.sin(angle), Math.cos(angle), 0, 0],
			[0, 0, 1, 0],
			[0, 0, 0, 1]
		]).mult(matrix);
	}
};

JL.Renderer = class {
	/**
	 * Canvas creation options
	 * @typedef {Object} RendererOptions
	 * @prop {number} [width=800] Width of the canvas
	 * @prop {number} [height=600] Height of the canvas
	 * @prop {boolean} [fullscreen=false] 
	 * @prop {HTMLElement} [root=document.body]
	 * @prop {Object} [contextOptions={}]
	 */

	/**
	 * Creates new canvas element and Renderer instance
	 * @param {RendererOptions} options 
	 */
	constructor({
		width = 800,
		height = 600,
		fullscreen = false,
		root = document.body,
		contextOptions = {}
	} = {}) {
		this.root = root;
		this.node = document.createElement("canvas");
		this.fullscreen = fullscreen;
		this.contextOptions = contextOptions;

		this.width = width;
		this.height = height;

		this.resize(width, height);

		if(fullscreen) {
			//Fullscreen();
		}

		this.root.appendChild(this.node);
	}

	resize(width, height) {
		this.width = width;
		this.height = height;
		this.center = new Vector(this.width / 2, this.height / 2);
	}

	get width() {
		return this.node.width;
	}

	set width(value) {
		this.node.width = value;
	}

	get height() {
		return this.node.height;
	}

	set height(value) {
		this.node.height = value;
	}
};

JL.Renderer2D = class extends JL.Renderer {
	/**
	 * Creates new 2D Renderer instance
	 * @param {RendererOptions} options 
	 */
	constructor(options) {
		super(options);

		/**
		 * @type {CanvasRenderingContext2D}
		 */
		this.ctx = this.node.getContext("2d", this.contextOptions);
	}

	clear() {
		//Simple trick for clearing the canvas
		this.node.width = this.node.width; /* eslint-disable-line */
	}

	/**
	 *
	 * @param {number | Vector} x
	 * @param {number} y
	 */
	translate(x, y) {
		if(x instanceof Vector) this.ctx.translate(x.x, x.y);
		else this.ctx.translate(x, y);
	}

	rotate(angle) {
		this.ctx.rotate(angle);
	}

	save() {
		this.ctx.save();
	}

	restore() {
		this.ctx.restore();
	}

	/**
	 *
	 * @example setBackground(0, 128, 255, 1)
	 * @param {number | Color} [r=0] red channel (0 - 255)
	 * @param {number} [g=0] green channel (0 - 255)
	 * @param {number} [b=0] blue channel (0 - 255)
	 * @param {number} [a=1] alpha channel (0 - 1)
	 */
	setBackground(r = 0, g = 0, b = 0, a = 1) {
		this.ctx.fillStyle = (r instanceof Color ? r : new Color(r, g, b, a)).toString();
		this.ctx.fillRect(0, 0, this.width, this.height);
	}
};

JL.Renderer3D = class extends JL.Renderer {
	/**
	 * Creates new 3D Renderer instance
	 * @param {RendererOptions} options 
	 */
	constructor(options) {
		super(options);

		/**
		 * @type {WebGLRenderingContext}
		 */
		this.gl = this.node.getContext("webgl", this.contextOptions);

		/**
		 * @type {JL.WebGLProgram}
		 */
		this.boundProgram = null;

		/**
		 * @type {JL.WebGLBuffer}
		 */
		this.boundBuffer = null;

		/**
		 * @type {JL.WebGLTexture}
		 */
		this.boundTexture = null;
	}

	/**
	 *
	 * @example setBackground(0, 128, 255, 1)
	 * @param {number | Color} r red channel (0 - 255)
	 * @param {number} g green channel (0 - 255)
	 * @param {number} b blue channel (0 - 255)
	 * @param {number} a alpha channel (0 - 1)
	 */
	setBackground(r, g, b, a) {
		if(r instanceof Color) [r, g, b, a] = [r.r, r.g, r.b, r.a];

		this.gl.clearColor(r / 255, g / 255, b / 255, a);
		this.gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}
};

/**
 * Creates HTML canvas. If first parameter is HTML DOM Element, canvas will be created in that element and set to fullscreen.
 * @deprecated Use `new JL.Renderer2D(...)` or `new JL.Renderer3D(...)` instead
 * @param {any} width Width of canvas or HTML DOM element
 * @param {number} height Height of canvas
 * @param {string} renderer 2d/webgl/webgl2
 * @param {Object} options HTML ELement where canvas will create
 * @param {HTMLElement} elm
 * @param {string} name
 * @returns {HTMLCanvasElement}
 */
function createCanvas(width = 800, height = 600, renderer = "2d", options = {}, elm = get("body"), name = CANVASES.length) {
	var node = document.createElement("canvas");
	node.renderer = renderer;

	if(typeof width === "number") {
		node.width = width;
		node.height = height;
		elm.appendChild(node);
	} else {
		width.appendChild(node);
		canvas = node;
		Fullscreen();
	}
	if(!CANVASES.length) {
		canvas = node;
		if(renderer == "2d") ctx = node.getContext("2d", options);
		else if(renderer == "webgl") gl = node.getContext("webgl", options);
		else throw new Error("[JustLibDraw] Unknown rendering context " + renderer);
		Height = canvas.height;
		Width = canvas.width;
		CENTER = new Vector(Width / 2, Height / 2);
	}

	CANVASES[name] = node;
	CANVASES.length++;
	return node;
}

/**
 * Returns a Vector containing center of the specified canvas
 * @deprecated Use `JL.Renderer.prototype.center` instead
 * @param {HTMLCanvasElement} _canvas
 * @return {Vector} 
 */
function getCenter(_canvas) {
	return new Vector(_canvas.width / 2, _canvas.height / 2);
}

/**
 * Set size of canvas to size of window.
 * @param {HTMLCanvasElement} _canvas
 */
function Fullscreen(_canvas = canvas) {
	_checkCanvas();
	_canvas.width = window.innerWidth;
	_canvas.height = window.innerHeight;
	if(_canvas == canvas) {
		Height = _canvas.height;
		Width = _canvas.width;
		CENTER = new Vector(Width / 2, Height / 2);
	}
	if(!_canvas.FULLSCREEN) window.addEventListener("resize", () => {Fullscreen(_canvas);});
	_canvas.FULLSCREEN = true;
}

/**
 * Resizes canvas to specific dimensions.
 * @deprecated Use `JL.Renderer.prototype.resize(...)` instead
 * @param {number} width
 * @param {number} height
 * @param {HTMLCanvasElement} _canvas
 */
function Resize(width, height, _canvas = canvas) {
	_checkCanvas();
	_canvas.width = width;
	_canvas.height = height;
	if(_canvas == canvas) {
		Width = _canvas.width;
		Height = _canvas.height;
		CENTER = new Vector(Width / 2, Height / 2);
	}
}

/**
 * Clears certain area or whole canvas.
 * @deprecated Use `JL.Renderer2D.prototype.clear(...)` instead
 * @param {number} x X-position of start
 * @param {number} y Y-position of start
 * @param {number} width Width of area
 * @param {number} height Height of area
 * @param {HTMLCanvasElement} _canvas
 */
function Clear(x = 0, y = 0, width = canvas.width, height = canvas.height, _canvas = canvas) {
	_checkCanvas();
	if(typeof x === "object") _canvas = x;
	var _ctx = _canvas.getContext(_canvas.renderer);
	if(!x || typeof x === "object") _canvas.width = _canvas.width; /* eslint-disable-line */ //Clear canvas trick for better performance
	else _ctx.clearRect(x, y, width, height);
}

/**
 * Translate origin of the canvas.
 * @deprecated Use `JL.Renderer2D.prototype.translate(...)` instead
 * @param {number} x X-position or Vector position
 * @param {number} y Y-position
 * @param {HTMLCanvasElement} _canvas
 */
function Translate(x = 0, y = 0, _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);
	if(x instanceof Vector) _ctx.translate(x.x, x.y);
	else _ctx.translate(x, y);
}

/**
 * Rotates canvas origin by angle.
 * @deprecated Use `JL.Renderer2D.prototype.rotate(...)` instead
 * @param {number} angle angle in radians
 * @param {HTMLCanvasElement} _canvas
 */
function Rotate(angle, _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);
	_ctx.rotate(angle);
}

/**
 * Saves canvas original rotation, position...
 * @deprecated Use `JL.Renderer2D.prototype.save(...)` instead
 * @param {HTMLCanvasElement} _canvas
 */
function Push(_canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);
	_ctx.save();
}

/**
 * Restores canvas original rotation, position...
 * @deprecated Use `JL.Renderer2D.prototype.restore(...)` instead
 * @param {HTMLCanvasElement} _canvas
 */
function Pop(_canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);
	_ctx.restore();
}

/**
 * Sets background.
 * @deprecated Use `JL.Renderer.prototype.setBackground(...)` instead
 * @param {number} r
 * @param {number} [g=r]
 * @param {number} [b=r]
 * @param {number} [a=1]
 * @param {HTMLCanvasElement} _canvas
 */
function Background(r, g = r, b = r, a = 1, _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);
	if(_ctx instanceof CONTEXT_2D) {
		_ctx.fillStyle = new Color(r, g, b, a).toString();
		_ctx.fillRect(0, 0, _canvas.width, _canvas.height);
	} else {
		gl.clearColor(r, g, b, a);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}
}


/**
 * Sets background.
 * @param {number} fps
 */
function Framerate(fps) {
	if(fps <= 0) throw new Error("[JustLibDraw] Framerate cannot be set to value equal or less than 0");
	FRAMERATE = fps;
}


/**
 * Adds ease-out transition between two values.
 * @param {number} from Starting number.
 * @param {number} to Final number.
 * @param {number} percent How many percent of differnce starting and final number should value change.
 * @param {boolean} [fps=true]
 * @param {Function} finish
 * @param {number} [value=0.5]
 * @returns {number}
 */
function Lerp(from, to, percent, fps = true, finish, value = .5) {
	if(abs(to - from) < value && finish) {
		finish();
		return from;
	}
	return ((percent * FRAMERATE) / (fps ? FPS : FRAMERATE)) * (to - from) + from;
}

/**
 * Adds ease-out transition between two colors.
 * @param {Color} from Starting color.
 * @param {Color} to Final color.
 * @param {number} percent How many percent of differnce starting and final number should value change.
 * @returns {Color}
 */
function LerpColor(from, to, percent) {
	return new Color(
		percent * (to.r - from.r) + from.r,
		percent * (to.g - from.g) + from.g,
		percent * (to.b - from.b) + from.b,
		percent * (to.a - from.a) + from.a
	);
}

/**
 * Sets glow. After this, all drawn elements will have glow, need to call setGlow() to prevent that.
 * @param {Color} color Color of blur.
 * @param {number} blur Pixel radius of blur.
 * @param {HTMLCanvasElement} _canvas
 */
function setGlow(color, blur, _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);
	_ctx.shadowBlur = blur;
	_ctx.shadowColor = color;
}

/**
 * Used to restore glow and prevent drawing glow on all elements.
 * @param {HTMLCanvasElement} _canvas
 */
function restoreGlow(_canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);
	_ctx.shadowBlur = 0;
	_ctx.shadowColor = "transparent";
}

/**
 * Function which runs only once.
 */
window.addEventListener("DOMContentLoaded", () => {
	if(typeof Setup !== "undefined") {
		if(Setup instanceof Function) {
			if(Setup() == "wait") return;
			if(typeof Draw !== "undefined") {
				if(Draw instanceof Function) {
					_newFrame();
				} else console.warn("[JustLibDraw] Function Setup() is overwritten!");
			}
		} else console.warn("[JustLibDraw] Function Setup() is overwritten!");
	}
});

/* Lib Functions */
function _newFrame() {
	var now = new Date().getTime();
	FPS = 1000 / (now - fpsTime);
	fpsTime = now;
	Draw();
	Frames++;
	if(FRAMERATE == 60) requestAnimationFrame(_newFrame);
	else {
		setTimeout(_newFrame, 1000 / FRAMERATE);
	}
}

function _checkCanvas() {
	if(!canvas) throw new Error("[JustLibDraw] Main canvas does not exist!");
	else return true;
}


function Write(vector, text, size = 18, color = "white", font = "monospace", style = "normal", center = false, _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);

	_ctx.beginPath();

	_ctx.font = style + " " + size + "px " + font;
	_ctx.fillStyle = color;
	//vector.x -= center ? _ctx.measureText(text).width / 2 : 0;
	//vector.y += center ? size / 2.5 : 0;
	_ctx.fillText(
		text + "",
		vector.x - (center ? _ctx.measureText(text).width / 2 : 0),
		vector.y + (center ? size / 2.5 : 0)
	);

	_ctx.closePath();
}

function Line(vector1, vector2, width = 1, color = "white", _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);

	_ctx.beginPath();
	_ctx.moveTo(vector1.x, vector1.y);
	_ctx.lineTo(vector2.x, vector2.y);
	_ctx.lineWidth = width;
	_ctx.strokeStyle = color;
	_ctx.stroke();
	_ctx.closePath();
}

function Point(vector, radius = 1, color1 = "white", width = 0, color2 = "red", _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);

	_ctx.beginPath();
	_ctx.arc(vector.x, vector.y, radius, 0, 2 * Math.PI, false);
	_ctx.fillStyle = color1;
	_ctx.fill();
	if(width) {
		_ctx.strokeStyle = color2;
		_ctx.lineWidth = width;
		_ctx.stroke();
	}
	_ctx.closePath();
}

function Rectangle(vector, width, height, color1 = "white", width2 = 0, color2 = "red", _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);

	_ctx.beginPath();
	_ctx.fillStyle = color1;
	_ctx.fillRect(vector.x, vector.y, width, height);
	if(width2) {
		_ctx.strokeStyle = color2;
		_ctx.lineWidth = width2;
		_ctx.strokeRect(vector.x, vector.y, width, height);
		_ctx.stroke();
	}
	_ctx.closePath();
}

function Triangle(vector1, vector2, vector3, color1 = "white", width = 0, color2 = "red", _canvas = canvas) {
	_checkCanvas();
	var _ctx = _canvas.getContext(_canvas.renderer);

	_ctx.beginPath();
	_ctx.moveTo(vector1.x, vector1.y);
	_ctx.lineTo(vector2.x, vector2.y);
	_ctx.lineTo(vector3.x, vector3.y);
	_ctx.fillStyle = color1;
	_ctx.strokeStyle = color1;
	if(width) {
		_ctx.lineWidth = width;
		_ctx.strokeStyle = color2;
		_ctx.stroke();
	} else _ctx.lineWidth = 0;
	_ctx.fill();
	_ctx.closePath();
}






/* ====== WebGL ====== */

/**
 * Signed 8-bit integer, with values in [-128, 127]
 */
JL.INT8 = WebGLRenderingContext.BYTE;

/**
 * Signed 16-bit integer, with values in [-32768, 32767]
 */
JL.INT16 = WebGLRenderingContext.SHORT;

/**
 * Signed 32-bit integer, with values in [-2147483648 to 2147483647]
 */
JL.INT32 = WebGLRenderingContext.INT;

/**
 * Unsigned 8-bit integer, with values in [0, 255]
 */
JL.UINT8 = WebGLRenderingContext.UNSIGNED_BYTE;

/**
 * Unsigned 16-bit integer, with values in [0, 65535]
 */
JL.UINT16 = WebGLRenderingContext.UNSIGNED_SHORT;

/**
 * Unsigned 32-bit integer, with values in [0, 4294967295]
 */
JL.UINT32 = WebGLRenderingContext.UNSIGNED_INT;

/**
 * 32-bit IEEE floating point number, with values in [-3.4E+38, +3.4E+38]
 */
JL.FLOAT32 = WebGLRenderingContext.FLOAT;


/**
 * 
 */
JL.NEAREST = WebGLRenderingContext.NEAREST;
JL.LINEAR = WebGLRenderingContext.LINEAR;

JL.REPEAT = WebGLRenderingContext.REPEAT;
JL.MIRRORED_REPEAT = WebGLRenderingContext.MIRRORED_REPEAT;
JL.CLAMP_TO_EDGE = WebGLRenderingContext.CLAMP_TO_EDGE;


/**
 * @typedef {JL.INT8 | JL.INT16 | JL.INT32 | JL.UINT8 | JL.UINT16 | JL.UINT32 | JL.FLOAT32} JL_TYPE
 */

/**
 * @typedef {JL.UINT8 | JL.UINT16 | JL.UINT32} JL_TYPE_UNISGNED
 */


/**
 * 
 * @param {JL_TYPE} type 
 * @param {boolean} [clamped=false]
 * @returns {Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Float32Array}
 */
JL._arrayFromType = function(type, clamped = false) {
	switch(type) {
		case JL.INT8: return Int8Array;
		case JL.INT16: return Int16Array;
		case JL.INT32: return Int32Array;
		case JL.UINT8: return clamped && Uint8ClampedArray || Uint8Array;
		case JL.UINT16: return Uint16Array;
		case JL.UINT32: return Uint32Array;
		case JL.FLOAT32: return Float32Array;
		default: throw new Error(`'${type}' is not valid type`);
	}
};

/**
 * 
 * @param {JL_TYPE} type 
 * @returns {number} Size of data type in bytes
 */
JL._sizeOf = function(type) {
	switch(type) {
		case JL.INT8: return 1;
		case JL.INT16: return 2;
		case JL.INT32: return 4;
		case JL.UINT8: return 1;
		case JL.UINT16: return 2;
		case JL.UINT32: return 4;
		case JL.FLOAT32: return 4;
		default: throw new Error(`'${type}' is not valid type`);
	}
};

/**
 * 4x4 matrix with `1`s on the main diagonal and `0`s elsewhere
 */
JL.IdentityMatrix = new Matrix([
	[1, 0, 0, 0],
	[0, 1, 0, 0],
	[0, 0, 1, 0],
	[0, 0, 0, 1]
]);


JL.WebGLShader = class {
	/**
	 * Creates new shader program
	 * @param {JL.Renderer3D} renderer 
	 * @param {WebGLShader} vertShader 
	 * @param {WebGLShader} fragShader 
	 */
	constructor(renderer, vertShader, fragShader) {
		this.renderer = renderer;
		// this.vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertShader);
		// this.fragmentShader = loadShader(gl, gl.VERTEX_SHADER, fragShader);

		//TODO: Move loadShader and createProgram into this class
		this.program = createProgram(this.renderer.gl, vertShader, fragShader);

		this.vertexSize = 0;

		/**
		 * @type {JL.WebGLAttribute[]}
		 */
		this.attributes = [];

		/**
		 * @type {JL.WebGLUniform[]}
		 */
		this.uniforms = [];

		/**
		 * @type {JL.WebGLBuffer}
		 */
		this.indexBuffer = null;
	}

	/**
	 * Creates and adds new attribute into shader program
	 * @param {AttributeOptions} options Attribute options
	 * @returns {JL.WebGLAttribute}
	 */
	addAttribute(options) {
		this.bind();
		const attribute = new JL.WebGLAttribute(this, options);

		this.vertexSize += attribute.size * JL._sizeOf(attribute.buffer.dataType);
		this.attributes.push(attribute);
		this.attributes[attribute.name] = attribute;

		return attribute;
	}

	/**
	 * Creates and adds new uniform into shader program
	 * @param {UniformOptions | string} options Uniform options or Uniform name
	 * @param {string} type Uniform type
	 * @returns {JL.WebGLUniform}
	 */
	addUniform(options, type) {
		this.bind();
		const uniform = new JL.WebGLUniform(this, typeof options === "string" ? {name: options, type: type} : options);

		this.uniforms.push(uniform);
		this.uniforms[uniform.name] = uniform;

		return uniform;
	}

	/**
	 * 
	 * @param {BufferOptions} options 
	 * @returns {JL.WebGLBuffer}
	 */
	addIndexBuffer(options) {
		this.bind();
		this.indexBuffer = new JL.WebGLBuffer(this, options);

		return this.indexBuffer;
	}

	bind(force = false) {
		if(this.renderer.boundProgram == this && !force) return;

		this.renderer.gl.useProgram(this.program);
		this.renderer.boundProgram = this;
	}

	/**
	 * @typedef {Object} DrawOptions
	 * @prop {number} [mode=WebGLRenderingContext.TRIANGLES] Type of primitive to render (POINTS | LINE_STRIP | LINE_LOOP | LINES | TRIANGLE_STRIP | TRIANGLE_FAN | TRIANGLES)
	 * @prop {number} [offset=0] Starting index in the array of vector points
	 * @prop {number} [count] Number of elements to be rendered (Automatically calculated from the first attribute buffer array)
	 */

	/**
	 * 
	 * @param {DrawOptions | number} options Drawing options or rendering mode
	 */
	draw(options) {
		let {
			mode = WebGLRenderingContext.TRIANGLES,	// eslint-disable-line prefer-const
			offset = 0,	// eslint-disable-line prefer-const
			count = undefined
		} = options;

		//Check if there are any attributes to draw
		const l = this.attributes.length;
		if(l == 0) return;

		this.bind();

		//Calculate count
		if(typeof options === "number") mode = options;

		//Calculate count
		if(count == undefined) count = this.indexBuffer ? this.indexBuffer.length : this.attributes[0].buffer.length / this.attributes[0].size;

		//Enable and use all attributes
		for(var i = 0; i < l; i++) {
			this.attributes[i].use();
		}

		if(this.indexBuffer) {
			this.renderer.gl.drawElements(
				mode,
				count,
				this.indexBuffer.dataType,
				offset * this.vertexSize
			);
		}
		else {
			this.renderer.gl.drawArrays(
				mode,
				offset,
				count
			);
		}
	}
};

JL.WebGLBuffer = class {
	/**
	 * @typedef {Object} BufferOptions
	 * @prop {JL_TYPE} dataType Data type of the attribute content
	 * @prop {ArrayLike<number>} data Number of components per vertex attribute
	 * @prop {number} target Specifying the binding point (ARRAY_BUFFER | ELEMENT_ARRAY_BUFFER)
	 * @prop {number} usage Usage pattern of the data store (STATIC_DRAW | DYNAMIC_DRAW | STREAM_DRAW)
	 * @prop {boolean} [clamped=false] Clamps Uint8 array to range [0, 255]
	 */

	/**
	 * Creates new buffer
	 * @param {JL.WebGLShader} shader Shader program
	 * @param {BufferOptions} options Buffer options
	 */
	constructor(shader, {
		dataType,
		data,
		target,
		usage,
		clamped = false
	}) {
		//Add properties
		this.shader = shader;
		this.dataType = dataType;
		this.target = target;
		this.length = data && data.length || 0;

		this.TypedArray = JL._arrayFromType(dataType, clamped);

		//this.shader.bind();

		//Create new buffer
		this.location = this.shader.renderer.gl.createBuffer();

		//Select buffer as the one to apply buffer operations to from here out
		this.bind();

		//Pass data into buffer
		//this.program.renderer.gl.bufferData(this.target, 11, usage);
		this.shader.renderer.gl.bufferData(this.target, new this.TypedArray(data), usage);
		if(data) this.update(data);
	}

	/**
	 * Updates buffer content
	 * @param {ArrayLike} data
	 * @param {number} offset
	 */
	update(data, offset = 0) {
		//Select buffer as the one to apply buffer operations to from here out
		//this.shader.bind();
		this.bind();

		//Pass data into buffer
		this.shader.renderer.gl.bufferSubData(this.target, offset, new this.TypedArray(data));
	}

	/**
	 * Binds buffer
	 * @param {boolean} force
	 */
	bind(force = false) {
		if(this.shader.renderer.boundBuffer == this && !force) return;

		this.shader.renderer.gl.bindBuffer(this.target, this.location);
		this.shader.renderer.boundBuffer = this;
	}

	/**
	 * Unbinds buffer
	 * @param {boolean} force
	 */
	unbind(force = false) {
		if(this.shader.renderer.boundBuffer != this && !force) return;

		this.shader.renderer.gl.bindBuffer(this.target, null);
		this.shader.renderer.boundBuffer = null;
	}
};

JL.WebGLAttribute = class {
	/**
	 * @typedef {Object} AttributeOptions
	 * @prop {string} name Name of the attribute variable whose location to get
	 * @prop {JL_TYPE} dataType Data type of the attribute content
	 * @prop {1 | 2 | 3 | 4} size Number of components per vertex attribute
	 * @prop {ArrayLike<number>} data Number of components per vertex attribute
	 * @prop {boolean} [normalize=false] Specifying whether integer data values should be normalized into a certain range when being casted to a float
	 * @prop {number} [usage] Usage pattern of the data store
	 * @prop {boolean} [clamped=false] Clamps Uint8 array to range [0, 255]
	 */

	/**
	 * Creates new uniform
	 * @param {JL.WebGLShader} shader Shader program
	 * @param {AttributeOptions} options Attribute options
	 */
	constructor(shader, {
		name,
		dataType,
		size,
		data = [],
		normalize = false,
		usage = WebGLRenderingContext.STATIC_DRAW,
		clamped = false
	}) {
		//Add properties
		this.shader = shader;
		this.name = name;
		this.size = size;
		this.normalize = normalize;
		this.isEnabled = false;

		//this.shader.bind();

		//Setup a buffer
		this.buffer = new JL.WebGLBuffer(this.shader, {dataType, data, target: WebGLRenderingContext.ARRAY_BUFFER, usage, clamped});
		this.update = this.buffer.update;

		this.shader.bind();

		//Get attribute location
		this.location = this.shader.renderer.gl.getAttribLocation(this.shader.program, this.name);
		this.enable();
	}

	enable(force = false) {
		if(this.isEnabled && !force) return;

		this.shader.renderer.gl.enableVertexAttribArray(this.location);
		this.isEnabled = true;
	}

	disable(force = false) {
		if(!this.isEnabled && !force) return;

		this.shader.renderer.gl.disableVertexAttribArray(this.location);
		this.isEnabled = false;
	}

	use() {
		this.enable();
		this.shader.bind();
		this.buffer.bind();
		this.shader.renderer.gl.vertexAttribPointer(this.location, this.size, this.buffer.dataType, this.normalize, 0, 0);
	}
};

JL.WebGLUniform = class {
	/**
	 * @typedef {Object} UniformOptions
	 * @prop {string} name Uniform name
	 * @prop {"1f"|"1fv"|"1i"|"1iv"|"2f"|"2fv"|"2i"|"2iv"|"3f"|"3fv"|"3i"|"3iv"|"4f"|"4fv"|"4i"|"4iv"|"Matrix2fv"|"Matrix3fv"|"Matrix4fv"} type Type of the uniform
	 */

	/**
	 * Creates new uniform
	 * @param {JL.WebGLShader} shader Shader program
	 * @param {UniformOptions} options Uniform options
	 */
	constructor(shader, {
		name,
		type
	}) {
		//Check for valid data type
		const _methodName = "uniform" + type;
		if(!(_methodName in shader.renderer.gl)) throw new TypeError(type + " is not valid uniform data type");

		//Add properties
		this.shader = shader;
		this.name = name;
		this.type = type;

		//Get uniform location
		this.location = this.shader.renderer.gl.getUniformLocation(this.shader.program, this.name);

		//Preprocessing values for better performance
		this._size = +type.match(/[1234]/);
		this._isInt = /[1234]i/.test(type);
		this._isMatrix = type.indexOf("Matrix") != -1;
		this._isVector = /[fi]v/.test(type) || this._size > 1 && !this._isMatrix;

		//TODO: Change this weird method system

		const method = function() {
			shader.renderer.gl[_methodName].apply(shader.renderer.gl, arguments);
		};

		//Single values
		if(this._size == 1) this._method = value => method(this.location, value);

		//Matrices
		else if(this._isMatrix && this._isInt) this._method = value => method(this.location, false, new Int32Array(value.toArray ? value.toArray() : value));
		else if(this._isMatrix && !this._isInt) this._method = value => method(this.location, false, new Float32Array(value.toArray ? value.toArray() : value));

		//Vectors
		else if(this._isVector && this._isInt) this._method = value => method(this.location, new Int32Array(value.toArray ? value.toArray(this._size) : value));
		else if(this._isVector && !this._isInt) this._method = value => method(this.location, new Float32Array(value.toArray ? value.toArray(this._size) : value));

		//Unknown
		else throw new Error("Cannot determine uniform update function based on uniform data type");
	}

	/**
	 * Updates uniform content
	 * @param {number | Vector | Matrix | JL.Object3D | ArrayLike<number>} value Data to be set
	 */
	update(value) {
		this.shader.bind();

		//Update value
		this._method(value);
	}
};

JL.WebGLTexture = class {
	/**
	 * @typedef {{width: number, height: number, pixeldata: ArrayLike} | ImageData | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap} TextureData
	 */

	/**
	 * @typedef {Object} TextureOptions
	 * @prop {string | TextureData} source 
	 * @prop {number} [target=WebGLRenderingContext.TEXTURE_2D] 
	 * @prop {boolean} [mipmap=true] 
	 * @prop {JL.NEAREST | JL.LINEAR} [mipmapFunc=JL.LINEAR] 
	 * @prop {JL.NEAREST | JL.LINEAR} [minFilterFunc=JL.LINEAR] 
	 * @prop {JL.NEAREST | JL.LINEAR} [magFilterFunc=JL.LINEAR] 
	 * @prop {JL.REPEAT | JL.MIRRORED_REPEAT | JL.CLAMP_TO_EDGE} [sWrapMode=JL.CLAMP_TO_EDGE] 
	 * @prop {JL.REPEAT | JL.MIRRORED_REPEAT | JL.CLAMP_TO_EDGE} [tWrapMode=JL.CLAMP_TO_EDGE] 
	 * @prop {number} [level=0] Specifies the level-of-detail number. Level `0` is the base image level, level `n` is the nth mipmap reduction image.
	 * @prop {number} [slot=0] Texture slot (in the range [0,31], could be less depending on a device) (default: 0)
	 */

	/**
	 * Creates new uniform
	 * @param {JL.WebGLShader} shader Shader program
	 * @param {string | TextureOptions} options Uniform options
	 */
	constructor(shader, options) {
		const {
			source = options,
			target = WebGLRenderingContext.TEXTURE_2D,
			mipmap = true,
			mipmapFunc = JL.LINEAR,
			minFilterFunc = JL.LINEAR,
			magFilterFunc = JL.LINEAR,
			sWrapMode = JL.CLAMP_TO_EDGE,
			tWrapMode = JL.CLAMP_TO_EDGE,
			level = 0,
			slot = 0
		} = options;

		//Add properties
		this.shader = shader;
		this.source = source;
		this.target = target;

		this.mipmap = mipmap;
		this.mipmapFunc = mipmapFunc;
		this.minFilterFunc = minFilterFunc;
		this.magFilterFunc = magFilterFunc;
		this.sWrapMode = sWrapMode;
		this.tWrapMode = tWrapMode;

		this.level = level;
		this.slot = slot;
		this.width = 0;
		this.height = 0;
		this.isPowerOf2 = false;

		//Create texture object
		this.texture = this.shader.renderer.gl.createTexture();

		//If source is string (link to the image) fetch it first
		if(typeof this.source === "string") {
			this._setDefaultTexture();
			this.loadTexture(this.source);
		}
		else this.update(source);
	}

	loadTexture(url) {
		const image = new Image();
		image.onload = () => {
			this.update(image);
			this.setParameters();

			//Fire load event
			if(typeof this.onload === "function") this.onload(image);
		};
		image.src = url;
	}

	setParameters({
		mipmap = this.mipmap,
		mipmapFunc = this.mipmapFunc,
		minFilterFunc = this.minFilterFunc,
		magFilterFunc = this.magFilterFunc,
		sWrapMode = this.sWrapMode,
		tWrapMode = this.tWrapMode,
		isPowerOf2 = this.isPowerOf2
	} = {}) {
		this.bind();

		let minFunc = null;
		let magFunc = null;

		//Compute minification and magnification filtering functions
		if(mipmap && isPowerOf2) {
			if(mipmapFunc == JL.LINEAR) {
				minFunc = minFilterFunc == JL.LINEAR && WebGLRenderingContext.LINEAR_MIPMAP_LINEAR || WebGLRenderingContext.LINEAR_MIPMAP_NEAREST;
			} else if(mipmapFunc == JL.NEAREST) {
				minFunc = minFilterFunc == JL.LINEAR && WebGLRenderingContext.NEAREST_MIPMAP_LINEAR || WebGLRenderingContext.NEAREST_MIPMAP_NEAREST;
			}

			magFunc = magFilterFunc == JL.LINEAR && WebGLRenderingContext.LINEAR || WebGLRenderingContext.NEAREST;
		} else {
			minFunc = minFilterFunc == JL.LINEAR && WebGLRenderingContext.LINEAR || WebGLRenderingContext.NEAREST;
			magFunc = magFilterFunc == JL.LINEAR && WebGLRenderingContext.LINEAR || WebGLRenderingContext.NEAREST;
		}

		//Texture wrap mode is not available for textures whose dimensions aren't power of two
		if(!isPowerOf2) {
			this.sWrapMode = JL.CLAMP_TO_EDGE;
			this.tWrapMode = JL.CLAMP_TO_EDGE;
		}

		//Set filter functions
		this.shader.renderer.gl.texParameteri(this.target, WebGLRenderingContext.TEXTURE_MIN_FILTER, minFunc);
		this.shader.renderer.gl.texParameteri(this.target, WebGLRenderingContext.TEXTURE_MAG_FILTER, magFunc);

		//Set texture wrap mode
		this.shader.renderer.gl.texParameteri(this.target, WebGLRenderingContext.TEXTURE_WRAP_S, sWrapMode);
		this.shader.renderer.gl.texParameteri(this.target, WebGLRenderingContext.TEXTURE_WRAP_T, tWrapMode);

		//Genrerate mipmaps
		if(mipmap) this.shader.renderer.gl.generateMipmap(this.target);
	}

	/**
	 * Binds the texture to texture slot
	 * @param {number} [slot=0] Texture slot (in the range [0,31], could be less depending on a device) (default: 0)
	 * @param {boolean} [force=false]
	 */
	bind(slot = 0, force = false) {
		if(this.shader.renderer.boundTexture == this && !force) return;

		this.shader.renderer.gl.activeTexture(WebGLRenderingContext.TEXTURE0 + slot);
		this.shader.renderer.gl.bindTexture(this.target, this.texture);
	}

	/**
	 * Updates uniform content
	 * @param {TextureData} value Data to be set
	 */
	update(value) {
		this.bind();

		this.width = value.width || value.videoWidth || 0;
		this.height = value.height || value.videoHeight || 0;
		this.isPowerOf2 = isPowerOf2(this.width) && isPowerOf2(this.height);

		if(value.pixeldata) {
			this.shader.renderer.gl.texImage2D(
				this.target,
				this.level,
				gl.RGBA,
				this.width,
				this.height,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				new Uint8Array(value.pixeldata)
			);
		} else {
			this.shader.renderer.gl.texImage2D(
				this.target,
				this.level,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				value
			);
		}
	}

	_setDefaultTexture() {
		this.update({
			width: 2,
			height: 2,
			pixeldata: [
				255, 0, 255, 255,
				0, 0, 0, 255,
				0, 0, 0, 255,
				255, 0, 255, 255,
			]
		});
		this.setParameters({
			mipmap: false,
			isPowerOf2: true,
			minFilterFunc: JL.NEAREST,
			magFilterFunc: JL.NEAREST,
			sWrapMode: JL.CLAMP_TO_EDGE,
			tWrapMode: JL.CLAMP_TO_EDGE,
		});
	}
};


JL.Object3D = class {
	/**
	 * Creates new uniform
	 * @param {JL.WebGLShader} program Shader program
	 */
	constructor(program) {
		this.position = new Vector(0, 0, 0);
		this.rotation = new Vector(0, 0, 0);
		this.scale = new Vector(1, 1, 1);

		this.positionMatrix = JL.IdentityMatrix.copy();
		this.scaleMatrix = JL.IdentityMatrix.copy();
		this.rotationMatrix = JL.IdentityMatrix.copy();

		this.modelMatrix = JL.IdentityMatrix.copy();
	}

	translateTo(x = 0, y = 0, z = 0) {
		this.position.x = x;
		this.position.y = y;
		this.position.z = z;

		this.updateModelMatrix();
	}

	translateBy(x = 0, y = 0, z = 0) {
		this.position.x += x;
		this.position.y += y;
		this.position.z += z;

		this.updateModelMatrix();
	}

	scaleTo(x = 1, y = 1, z = 1) {
		this.scale.x = x;
		this.scale.y = y;
		this.scale.z = z;

		this.updateModelMatrix();
	}

	scaleBy(x = 1, y = 1, z = 1) {
		this.scale.x *= x;
		this.scale.y *= y;
		this.scale.z *= z;

		this.updateModelMatrix();
	}

	rotateTo(x = 0, y = 0, z = 0) {
		this.rotation.x = x;
		this.rotation.y = y;
		this.rotation.z = z;

		this.updateModelMatrix();
	}

	rotateBy(x = 0, y = 0, z = 0) {
		this.rotation.x += x;
		this.rotation.y += y;
		this.rotation.z += z;

		this.updateModelMatrix();
	}

	updateModelMatrix() {
		const mat = new Matrix([
			[this.scale.x, 0, 0, this.position.x],
			[0, this.scale.y, 0, this.position.y],
			[0, 0, this.scale.z, this.position.z],
			[0, 0, 0, 1]
		]);

		this.rotationMatrix = Rotate3D.x(mat, this.rotation.x);
		this.rotationMatrix = Rotate3D.y(this.rotationMatrix, this.rotation.y);
		this.rotationMatrix = Rotate3D.z(this.rotationMatrix, this.rotation.z);

		this.modelMatrix = this.rotationMatrix;
	}

	toArray() {
		return new Float32Array(this.modelMatrix.toArray());
	}
};

JL.Camera = class extends JL.Object3D {
	constructor(near, far) {
		super();

		this.near = near;
		this.far = far;

		this.updateProjectionMatrix();
	}

	/**
	 * 
	 * @param {JL.Object3D} object
	 */
	lookAt(object) {
		const dx = object.position.x - this.position.x;
		const dy = object.position.y - this.position.y;
		const dz = object.position.z - this.position.z;

		this.rotateTo(
			Math.atan2(dy, dz),
			Math.atan2(dx, dz)
		);
	}

	setNear(value) {
		this.near = value;
		this.updateProjectionMatrix();
	}

	setFar(value) {
		this.far = value;
		this.updateProjectionMatrix();
	}

	updateProjectionMatrix() {
		this.projectionMatrix = JL.IdentityMatrix.copy();
	}
};

JL.PerspectiveCamera = class extends JL.Camera {
	/**
	 * Creates new perspective camera
	 * @param {number} fov Field of view
	 * @param {number} aspect Aspect ratio of the canvas
	 * @param {number} near Near clipping plane
	 * @param {number} far Far clipping plane
	 */
	constructor(fov = 0.8726, aspect = 1, near = 0.1, far = 2000) {
		super(near, far);

		this.fov = fov;
		this.aspect = aspect;

		this.updateProjectionMatrix();
	}

	setFov(value) {
		this.fov = value;
		this.updateProjectionMatrix();
	}

	setAspect(value) {
		this.aspect = value;
		this.updateProjectionMatrix();
	}

	updateProjectionMatrix() {
		this.projectionMatrix = new Matrix([
			[1 / Math.tan(this.fov / 2) / this.aspect, 0, 0, 0],
			[0, 1 / Math.tan(this.fov / 2), 0, 0],
			[0, 0, (this.far + this.near) * (1 / (this.near - this.far)), (2 * this.near * this.far) * (1 / (this.near - this.far))],
			[0, 0, -1, 0]
		]);
	}
};

JL.OrthographicCamera = class extends JL.Camera {
	/**
	 * Creates new perspective camera
	 * @param {number} left 
	 * @param {number} right 
	 * @param {number} top 
	 * @param {number} bottom 
	 * @param {number} near Near clipping plane
	 * @param {number} far Far clipping plane
	 */
	constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2000) {
		super(near, far);

		this.left = left;
		this.right = right;
		this.top = top;
		this.bottom = bottom;

		this.updateProjectionMatrix();
	}

	setLeft(value) {
		this.left = value;
		this.updateProjectionMatrix();
	}

	setRight(value) {
		this.right = value;
		this.updateProjectionMatrix();
	}

	setTop(value) {
		this.top = value;
		this.updateProjectionMatrix();
	}

	setBottom(value) {
		this.bottom = value;
		this.updateProjectionMatrix();
	}

	updateProjectionMatrix() {
		this.projectionMatrix = new Matrix([
			[2 / (this.right - this.left), 0, 0, 0,],
			[0, 2 / (this.top - this.bottom), 0, 0],
			[0, 0, 2 / (this.near - this.far), 0],
			[(this.left + this.right) / (this.left - this.right), (this.bottom + this.top) / (this.bottom - this.top), (this.near + this.far) / (this.near - this.far), 1]
		]);
	}
};



/**
 * Loads shader
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {number} type Vertex or Fragment Shader
 * @param {string} source Source code
 * @returns {WebGLShader} Loaded Shader
 */
function loadShader(gl, type, source) {
	const shader = gl.createShader(type);

	//Send the source to the shader object
	gl.shaderSource(shader, source);

	//Compile the shader program
	gl.compileShader(shader);

	//Handle compilation errors
	if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		//gl.deleteShader(shader);
		//console.error("An error occurred compiling the shaders:");
		const err = gl.getShaderInfoLog(shader);
		const line = err.match(/ERROR: (\d*?):(\d*?):/)[2];
		const lines = source.split("\n");

		lines[line - 1] = "> " + lines[line - 1];

		console.error(lines.join("\n"));
		throw err;
	}

	return shader;
}


/**
 * Initialize and links shader program
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {string} vsSource Vertex or Fragment Shader
 * @param {string} fsSource Source code
 * @returns {WebGLProgram} Shader Program
 */
function createProgram(gl, vsSource, fsSource) {
	const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
	const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

	// Create the shader program
	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	//Handle errors
	if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		//console.error("Unable to initialize the shader program:", gl.getProgramInfoLog(shaderProgram));
		throw gl.getProgramInfoLog(shaderProgram);
	}

	return shaderProgram;
}

/**
 * Initialize buffer
 * @deprecated Use `new JL.WebGLBuffer(...)` instead
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {Array} data Array of data
 * @param {number} [usage=CONTEXT_WEBGL.STATIC_DRAW] Data usage
 * @returns {WebGLBuffer} WebGL Buffer
 */
function createBuffer(gl, data, usage = gl.STATIC_DRAW) {
	//Create new buffer
	const positionBuffer = gl.createBuffer();

	//Select buffer as the one to apply buffer operations to from here out
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

	//Pass data into buffer
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);

	return positionBuffer;
}

/**
 * Initialize buffer
 * @deprecated Use `JL.WebGLBuffer#update(...)` instead
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {WebGLBuffer} buffer WebGL Buffer
 * @param {Array} data Data array
 */
function updateBuffer(gl, buffer, data) {
	//Select buffer as the one to apply buffer operations to from here out
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

	//Pass data into buffer
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(data));
}

/**
 * Initialize buffer
 * @deprecated Use `updateBuffer(...)` instead
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {WebGLBuffer} buffer WebGL Buffer
 * @param {Array} data Array of data
 */
var changeBuffer = updateBuffer;


/**
 * Update unoform content
 * @deprecated Use `JL.WebGLUniform#update(...)` instead
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {WebGLProgram} program Shader Program
 * @param {WebGLUniformLocation} location Uniform location
 * @param {"1f"|"1fv"|"1i"|"1iv"|"2f"|"2fv"|"2i"|"2iv"|"3f"|"3fv"|"3i"|"3iv"|"4f"|"4fv"|"4i"|"4iv"|"Matrix2fv"|"Matrix3fv"|"Matrix4fv"} datatype uniform data type
 * @param {Array} data Data array
 */
function updateUniform(gl, program, location, datatype, data) {
	//if(data.length % 2) throw new Error("[JustLibDraw] Invalid data pairs! (UniformLocation, DataToBeSet)");
	const unoformMethod = "uniform" + datatype;
	if(!(unoformMethod in gl)) throw new TypeError(datatype + " is not valid uniform data type");

	//Select program
	if(!gl.isProgram(program)) gl.useProgram(program);

	//Update data
	gl[unoformMethod]();
	//for(var i = 0; i < data.length; i += 2) {
	//	gl.uniformMatrix4fv(data[i + 0], false, new Float32Array(data[i + 1]));
	//}
}

/**
 * Initialize buffer
 * @deprecated Use `updateBuffer(...)` instead
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {WebGLBuffer} buffer WebGL Buffer
 * @param {Array} data Array of data
 */
var changeUniform = updateUniform;

/**
 * Links buffer with attribute in WebGL Shader Program
 * @deprecated Use `JL.WebGLAttribute#use()` instead
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {WebGLProgram} program Shader Program
 * @param {string} attribute Data usage
 * @param {WebGLBuffer} buffer WebGL Buffer with data
 * @param {number} [size=3] Size per one data record (size of the vector)
 * @param {number} [type=CONTEXT_WEBGL.FLOAT] Type of data
 * @returns {number} Location of attribute in program
 */
function manageAttribute(gl, program, attribute, buffer, size = 3, type = gl.FLOAT) {
	//Select program
	/* if(!gl.isProgram(program))  */gl.useProgram(program);

	//Get location
	const location = gl.getAttribLocation(program, attribute);
	gl.enableVertexAttribArray(location);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribPointer(location, size, type, false, 0, 0);

	return location;
}

/**
 * Creates new texture from image or url of image
 * @deprecated Use `new JL.WebGLTexture(...)` instead
 * @param {WebGLRenderingContext} gl WebGL Rendering Context
 * @param {Image|HTMLImageElement|HTMLVideoElement|String} [content] URL of the image, or image or video object
 * @returns {WebGLTexture} Created texture
 */
function createTexture(gl, content = null) {
	//Create new texture
	const texture = gl.createTexture();

	//Add single blue pixel to it, while the image is loading
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
		1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
		new Uint8Array([0, 0, 255, 255]));

	//If there is default contentm, add it to the texture
	if(content) updateTexture(gl, texture, content);

	// eslint-disable-next-line no-constant-condition
	if(false /*&& isPowerOf2(image.width || image.videoWidth) && isPowerOf2(image.height || image.videoHeight)*/) {
		// Yes, it's a power of 2. Generate mips.
		gl.generateMipmap(gl.TEXTURE_2D);
	} else {
		// No, it's not a power of 2. Turn of mips and set wrapping to clamp to edge
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	}

	return texture;
}

/**
 * Update content of the texture
 * @deprecated Use `JL.WebGLTexture#update(...)` instead
 * @param {WebGLRenderingContext} gl
 * @param {WebGLTexture} texture
 * @param {Image|HTMLImageElement|HTMLVideoElement|string} content
 */
function updateTexture(gl, texture, content) {
	//Bind image with texture
	const bindTexture = image => {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	};

	//Load image from URL
	if(typeof content === "string") {
		const image = new Image();
		image.onload = e => bindTexture(image);
		image.src = content;
	} else bindTexture(content);
}


/* Matrix Manipulation */

/**
 * Constructs Perpective Projection matrix
 * @param {number} fov WebGL Rendering Context
 * @param {number} aspect Vertex or Fragment Shader
 * @param {number} zNear Source code
 * @param {number} zFar Source code
 * @returns {Matrix} Perpective Projection matrix
 */
Matrix.perspective = function(fov, aspect, zNear, zFar) {
	return new Matrix([
		[1 / tan(fov / 2) / aspect, 0, 0, 0],
		[0, 1 / tan(fov / 2), 0, 0],
		[0, 0, (zFar + zNear) * (1 / (zNear - zFar)), -1],
		[0, 0, (2 * zNear * zFar) * (1 / (zNear - zFar)), 0]
	]);
};

/**
 * Translates coordinations of Matrix
 * @param {number} args Vector properties
 * @returns {Matrix}
 */
Matrix.prototype.translate = function(...args) {
	var m = this.copy();
	/*for(var i = 0; i < this.cols; i++) {
		m.matrix[this.rows - 1][i] += args[i] || 0;
	}*/
	for(var i = 0; i < this.cols; i++) {
		m.matrix[i][this.cols - 1] += args[i] || 0;
	}
	return m;
};

/**
 * Scales coordinations of Matrix
 * @param {number} args Scale properties
 */
Matrix.prototype.scale = function(...args) {
	for(var i = 0; i < this.rows; i++) {
		for(var j = 0; j < this.cols; j++) {
			this.matrix[i][j] *= args[i] || 1;
		}
	}
};