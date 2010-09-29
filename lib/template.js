var parse = require("./parse").parse,
    when = require("promise").when,
    defaultRules = require("./rules"),
    toJSON = require("commonjs-utils/json-ext").stringify;

var Template = exports.Template = function(source, options, noWrapper){
	var options = options || {};

	options.resolver = options.resolver || require("./resolver").Resolver;

	var state = {
		resolver: options.resolver
	};
	
	options.rules=options.rules || require("./rules").Rules(options);

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
	options.footer = '} return $text.join("");';
	var parsed;
	return when(source, function(source){
		parsed = parse(source, state, options); 
		return when(parsed, function(parsed){
			if (!noWrapper){
				var wrapped = [options.header,parsed, options.footer].join('');
				return new Function('$data', wrapped);
			}else{
				return parsed;
			}
		});
	});
}

var extendTemplate=function(state,options){
	var templateString = options.resolver(state.extension.templateName, true)
	return Template(templateString, options, state.extension, true);
};

