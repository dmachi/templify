var Template = require("./template").Template;
var Rules = require("./rules").Rules;

exports.TemplateEngine=function(options){
	var resolver = options.resolver(options.store)
	options.resolver = resolver;	
	options.rules = Rules(options);
	var engine = {
		compile: function(id){
			return Template(resolver(id),options);
		}
	}		

	return engine;
}

exports.Resolver = require("./resolver").Resolver;

exports.renderTemplate = function(templateString, context, options){
	var template = new Template(templateString, options);
	return template(context);
};

exports.getTemplateFunction = function(templateString, options){
	var template = new Template(templateString,options);
	return template.parse(templateString);
};
