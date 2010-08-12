var parse = require("./parse").parse;

var defaultRules = require("./rules");

var Template = exports.Template = function(source, options, noWrapper){
	var state = {
		resolver: options.resolver
	};
	
	if (!options.rules){
		options.rules=require("./rules").Rules;
	}

	if (options.extension){
		state.extension  = options.extension ;
	}

	// header for compiled template function
	// TODO change this so we can be provided a write function and stream the template gen
	options.header = 	[	'var $text = [];',
				'var _write = function(text) {',
					'$text.push((typeof text == "number")?text:(text||""));',
				'};', 
				'with($data){ '
			].join('');

	// footer for compiled template function
	options.footer = '} return $text.join("");'

	var functionText = parse(source,state,options);


	if (!noWrapper){
		return new Function('$data', options.header + functionText + options.footer);	
	}
	return functionText;
}

var extendTemplate=function(state,options){
	//print("Extend Template")
	//print("\t" + serialize(extension));
	var templateString = options.resolver(state.extension.templateName, true)
	//print("Got Template String. Length: " + templateString.length);
	return Template(templateString, options, state.extension, true);
};

