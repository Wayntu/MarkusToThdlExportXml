   // �Q�� global variable �x�s side-effects����T�]ThdlExportXMLToSTAMLFuncs.js �|�ϥΨ�^...
   // �`�N�GThdlExportXMLToSTAMLFuncs() ���J��|�ߧY����A
   //var GvarThdlExport = { featureAnalysisTags: [],
   //                       personNameTagIdAsFeature: true,         // �O�_�n�N cbdbid ������ id ��@���W���R����ܪ� term
   //                       placeNameTagIdAsFeature: true,          // �O�_�n�N placename_id ��@���W���R�����J
   //                       datetimeTagIdAsFeature: true,
   //                     };          

var ThdlExportXMLToSTAMLFuncs = (function(){
   //GvarThdlExport['featureAnalysisTags'] = [];
  
   var termEscape = function(t) {             // 20170412
      t = t.replace(/[\|]/g, ',').replace(/[\(\)]/g,'');            // .replace(/[:]/g,'_');
      //if (t.length > 61) t = t.substr(0,61) + '...';    // �]�����Ǧr Markus �|�� &#(nnnnn); �覡��X�A�I���a��|�X���]���A�B�z�^
      return t;
   }
 
   var sectionDividerTable = {
      chapter: false,
		section: "//Paragraph"
	}

   // 2017-01-19: tagTable �O�B�z�u�q ThdlExportXml �ഫ�� object model�v�һݪ����F
   //             ���q object model ��X�� ThdlExportXml�A�����I�s generateTag()!
	var tagTable = [
		{ type: "PersonName", xpath: "//PersonName" },
		{ type: "LocName", xpath: "//LocName" },
    { type: "datetime", xpath: "//Date"},
    { type: "thing", subtype: "specific", xpath: "//SpecificTerm"},
    { type: "drugname", xpath: "//DrugName"},
    { type: "recipe", xpath: "//Recipe"},
    { type: "udef_h", xpath: "//Udef_h"},
  ];

  var tagTable = [];
	var tagIgnore = [];
  
  var XMLtoObject = function(xmlNode){
		if( xmlNode.childNodes.length === 1 && xmlNode.firstChild.nodeType === 3 ){
			return xmlNode.firstChild.nodeValue.escape();
		}
    
    if( xmlNode.nodeType === 3 ){
      return xmlNode.nodeValue;
    }
		
		var object = [];
    var isArray = false;
		var childNodes = xmlNode.childNodes;
		for( var i = 0 ; i < childNodes.length ; ++i ){
			if( childNodes[i].nodeType === 3 ){
        isArray = true;
        object.push(childNodes[i].nodeValue);
      }
      else{
        var obj = {};
        obj[childNodes[i].nodeName] = XMLtoObject( childNodes[i] );
        object.push(obj);
      }
		}
    
    var attr = xmlNode.attributes;
    for( var i = 0 ; i < attr.length ; ++i ){
      var obj = {};
      obj[attr[i].nodeName] = attr[i].nodeValue;
      object.push(obj);
    }
    
		if( !isArray ){
      var realObj = {};
      for( var i = 0 ; i < object.length ; ++i ){
        for( var j in object[i] ){
          realObj[j] = object[i][j];
        }
      }
      object = realObj;
    }
		return object;
	}
	
   function appendCustomizedTags(customizedTags) {        // Tu
      //{ type: "Udef_h", xpath: "//Udef_h"},
	   var tagHash = {};
	   for (var i=0; i<tagTable.length; i++) {
	      tagHash[tagTable[i].type] = 1;
	   }

      for (var i=0; i<customizedTags.length; i++) {           // �N Markus html �� <span type="xxx"> �ন <Udef_xxx> 
         var tag = customizedTags[i];
	      if (tag.substr(0,5) !== 'Udef_' && !tagHash[tag]) {
	         var tagType = tag;          // �b ThdlExportXml �����ҦW�١A�� Udef_<tag>
	         var xpath = "//" + tagType;
	         var entry = { type: tagType,
	                       xpath: xpath
	                     };
            tagTable.push(entry);
            tagHash[tag] = 1;
         }
     }

	   //alert(JSON.stringify(tagTable));
	}

  function flattenRecursiveNode( nodes ){
    result = []
    for ( let i in nodes ){
      let node = nodes[i]
      if ( node.nodeName === 'MarkusDiv' ){
        node.childNodes.forEach( (currentValue, currentIndex, listObj) => {
          result.push(currentValue)
        })
      } else result.push(node)
    }
    return result
  } 

  var tagTransformer = function( context ){
			var content = [];
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");


      // only for markusdiv tag
      const nodes = flattenRecursiveNode(xmlDoc.firstChild.childNodes);
      // 2018/01/19 begining transformation
      for (let i in nodes) {
        let node = nodes[i]
        if( node.nodeType == 3 && node.nodeValue.trim().replace(/^\s+|\s+$/g, '') !== "" ) {
          // pure text
          content.push( nodes[i].nodeValue );
				} else if (node.nodeType == 1) {
          node = createXMLDocumentFromNode(node)
          let ignore = false;
          
          // filter the tag
          for (let j in tagIgnore) {
						if( node.evaluate(tagIgnore[j], node, null, XPathResult.ANY_TYPE, null).iterateNext() ){
							ignore = true;
							break;
						}
          }
          if(!ignore) {
            content.push(recursiveXML(node))
          }
        } else {
          //console.log(node)
        }
      }
			return content;
		}
    var recursiveXML = function( node ){
    
		var content = {};
		var last = content;
		var now = content;
		for( var i = 0 ; i < tagTable.length ; i++ ){
		   // document.evaluate( xpathExpression, contextNode, namespaceResolver, resultType, result );
      var tags = node.evaluate( tagTable[i].xpath, node, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
      var tag;
      let j = 0
			while( tag = tags.iterateNext() ){ 
        
				now.type = tagTable[i].type;
				if( tagTable[i].subtype ){
					now.subtype = tagTable[i].subtype;
				}
				if( tagTable[i].userdata ){
					now.userdata = (new XMLTableToJSON(tagTable[i].userdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.userdata).length === 0 ){
						now.userdata = undefined;
						delete now.userdata;
					}
				}
				if( tagTable[i].linkdata ){
					now.linkdata = (new XMLTableToJSON(tagTable[i].linkdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.linkdata).length === 0 ){
						now.linkdata = undefined;
						delete now.linkdata;
					}
        }
        //2018-01-24
        let attributes = tag.attributes;
        for (let i = 0; i < attributes.length; i++) {
          let name = attributes[i].name
          let value = attributes[i].value
          now[name] = value
        }



				last = now;
				now.content = {};
        now = now.content;
        now = {}
			}
    }
    
    last.content = node.firstChild.textContent;
    // return content
    return last
	}
  
  var objectToXML = function(object){
		if( String.isString(object) ){
			return object.escape();
		}
		
		if( Array.isArray(object) ){
			return object.map(objectToXML).join("");
		}
		
		var xmlString = "";
		for( var key in object ){
      if( key === "#text" ){
        xmlString += object[key];
        continue;
      }
			xmlString += "<" + key + ">" + objectToXML(object[key]) + "</" + key + ">";
		}
		return xmlString;
	}
  
  var generateTag = function(object) {
     //alert(JSON.stringify(object));
     if (Array.isArray(object)) {
        return object.map(function(e) { return generateTag(e); }).join("");
     }
     if( String.isString(object) ){
       return object;
     }
     if (typeof object !== "undefined" && object.type) {     // 2017-01-20
        if (typeof object.content == "undefined") object.content = "";   // ...
        var tagAttr = "";                       // 2017-03-22
        if (object.userdata) {
           var noteVal = object.userdata["note"];
           if (noteVal) {
              tagAttr = ' RefId="' + noteVal + '"';
           }
           //alert(JSON.stringify(object.userdata) + JSON.stringify(object.type));
        }

        switch (object.type) { 
        case "person":
           var attrList = [];        // Tu: 2017-02-20
           for (var key in object.linkdata) {
              attrList.push(key + '="' + object.linkdata[key] + '"');
              if (key === 'CbdbId' && GvarThdlExport['personNameTagIdAsFeature']) {     // 20170412, 20170426
                 var termVal = termEscape(object.linkdata[key]);
                 attrList.push('Term="cbdb_' + termVal + '"');   // 20170412
              }
           }
           var attrStr = (attrList.length == 0) ? '' : ' ' + attrList.join(' ');
           if (object.userdata && object.userdata['note']) {
              if (GvarThdlExport['personNameTagIdAsFeature']) {     // 20170412, 20170426
                 tagAttr += ' Term="' + termEscape(noteVal) + '"';
              }
           }
           return "<PersonName" + attrStr + tagAttr + ">" + generateTag(object.content) + "</PersonName>";
        case "location":
           if (object.userdata && object.userdata['note']) {
              if (GvarThdlExport['placeNameTagIdAsFeature']) {     // 20170412, 20170426
                 tagAttr += ' Term="' + termEscape(noteVal) + '"';
              }
           }
           return "<LocName" + tagAttr + ">" + generateTag(object.content) + "</LocName>";
        case "datetime":
           if (object.userdata && object.userdata['note']) {
              if (GvarThdlExport['datetimeTagIdAsFeature']) {     // 20170412, 20170426
                 tagAttr += ' Term="' + termEscape(noteVal) + '"';
              }
           }
           return "<Date" + tagAttr + ">" + generateTag(object.content) + "</Date>";
        //case "recipe":
        //   return "<SubDoc Key='Recipe'>" + generateTag(object.content) + "</SubDoc>";
        //case "drugname":
        //   return "<DrugName>" + generateTag(object.content) + "</DrugName>";
        case "thing":
           if (object.subtype === "specific" ) {      // 2017-03-28
            return "<SpecificTerm Type='officialTitle'" + tagAttr + ">" + generateTag(object.content) + "</SpecificTerm>";
           }
           else {
              return '<Thing Type="' + object.subtype + tagAttr + '">' +
                      generateTag(object.content) + "</Thing>";
           }
        case "office":
           return "<Office Type='" + object.subtype + "'" + tagAttr + ">" + generateTag(object.content) + "</Office>";
        case "specificTerm":
           return "<SpecificTerm Type='" + object.subtype + "'" + tagAttr + ">" + generateTag(object.content) + "</SpecificTerm>";
        case "comment":        // 20170418
           if (s = generateTag(object.content)) return "<Comment>" + s + "</Comment>";
           else return '';     // skip empty comment
        case "commentItem":    // 20170421
           return "<CommentItem Category='" + object.subtype + "'>" + generateTag(object.content) + "</CommentItem>";
        case "markusDiv":      // 20170422
           tagAttr = (object.userdata) ? (" Value='" + object.userdata["note"] + "'") : "";
           return "<MarkusDiv Type='" + object.subtype + "'" + tagAttr + ">" + generateTag(object.content) + "</MarkusDiv>";
        case "span":
           var t = "<" + object.type + tagAttr + ">" + generateTag(object.content) + "</" + object.type + ">";
           return t;
        case "div":     // 2017-04-07: YangWanLi file contains many <div> tags...
           var t = "<" + object.type + tagAttr + ">" + generateTag(object.content) + "</" + object.type + ">";
           return t;
        case "font":
           return '';   // 2017-04-07: ZGZY file contains one suspicious <font>, simply skip it...
       case "pre":      // 2017-08-17: fix MARKUS error (to have more than one <div class="doc><pre>)
           return generateTag(object.content);
        default:        // Udef_xxx
           var utag = object.type;
           if (utag.indexOf("Udef_") === 0 && utag.length > 5) {     // 20170621: ���ɷ|�� 'Udef_' �����ҡH
              GvarThdlExport['featureAnalysisTags'].push(object.type);
              //console.log(JSON.stringify(GvarThdlExport.featureAnalysisTags));
              var t = "<" + object.type + tagAttr + ">" + generateTag(object.content) + "</" + object.type + ">";
              return t;
           }
           else return '';
        }
     }
  }
  
  
  return {
    // document level meta-data extraction
    documentInformation: function(context){
      var dom = tryParseXML(context);             // 2016-09-16
		  if (dom === null) return null;

      var metadata = {};
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(context, "text/xml");
      
      // Tu 2017-02-08: should I append customized tags here? (will it be invoked several times?)
      var descendentNodes = xmlDoc.getElementsByTagName("*");
      var customizedTags = [];
      for (var i=0; i<descendentNodes.length; i++) {
        customizedTags.push(descendentNodes[i].tagName);
      }
      appendCustomizedTags(customizedTags);     // append Udef_xxx tags to tagTable
      
      
      var doc = xmlDoc.getElementsByTagName("document")[0];
      var childNodes = doc.childNodes;
      for( var i = 0 ; i < childNodes.length ; ++i ){
        if( childNodes[i].nodeName !== "doc_content" ){
          metadata[childNodes[i].nodeName] = XMLtoObject(childNodes[i]);
        } 
      }
      
      var attr = doc.attributes;
      for( var i = 0 ; i < attr.length ; ++i ){
        metadata[attr[i].nodeName] = attr[i].nodeValue;
      }
      return {
        metadata: metadata
      };
    },
    
    articleInformation: function( context ){
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");
			var chapters = [];
			if( sectionDividerTable.chapter ){
        var nodes = xmlDoc.evaluate(sectionDividerTable.chapter, xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        var node;
				while( node = nodes.iterateNext() ){
					chapters.push( {type: "chapter", content: createXMLDocumentFromNode(node)} );
				}
			}
			else{
				chapters.push({type: "chapter", content: xmlDoc} );
			}
			var sections = [];
			for( var i = 0 ; i < chapters.length ; i++ ){
				sections.push({type: "chapter", content: []});
				var nodes = chapters[i].content.evaluate(sectionDividerTable.section, chapters[i].content, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        var node;
        if( !(node = nodes.iterateNext()) ){
          sections[i].content.push({ type: "section", content: tagTransformer((new XMLSerializer()).serializeToString(chapters[i].content.getElementsByTagName("doc_content")[0]))});
        }
        else{
          do {
            sections[i].content.push({ type: "section", content: tagTransformer((new XMLSerializer()).serializeToString(node))});
            /*
            for( var j = 0 ; j < sectionDividerTable.sectionAppdata.length ; ++j ){
              var doc = createXMLDocumentFromNode(node);
              var appdata = doc.evaluate(sectionDividerTable.sectionAppdata[j].from, node, null,  XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
              while( data = appdata.iterateNext() ){
                console.log( ":)" + sections[i].content );
                if( !sections[i].content[sections[i].content.length-1].application ){
                  sections[i].content[sections[i].content.length-1].application = {};
                }
                sections[i].content[sections[i].content.length-1].application[sectionDividerTable.sectionAppdata[j].to] = data.textContent;
              }
            }
            */
          } while ( node = nodes.iterateNext() );
        }
      }
			return sections;
		},
      
    mergeToContext: function(input){
      //alert(JSON.stringify(input));
      var filename = input.document.metadata['filename'];        // Tu
      
      var xmlString = "<ThdlPrototypeExport>" +
                      //"<corpus><feature_analysis></feature_analysis></corpus>" +
                      "<documents><document filename='" + filename + "'><doc_content></doc_content></document></documents>" +
                      "</ThdlPrototypeExport>";
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(xmlString, "text/xml");
      
      var metadataXML = objectToXML(input.document.metadata);
      appendAllChildren( metadataXML, xmlDoc.getElementsByTagName("document")[0]);
      
      var article = input.article;
      var allChaptersXML = "";          // Tu
      for( var i = 0 ; i < article.length ; ++i ){
        var chapter = article[i];
        for( var j = 0 ; j < chapter.content.length ; ++j ){
          var section = chapter.content[j];
          //alert("Paragraph: " + JSON.stringify(section));
          var sectionXML = "<Paragraph";
          // Tu: 20170410, �`�N�o�جO�n��X�� DocuSky XML�A�]�� RefId �Ĥ@�Ӧr�����j�g...
          if (section.refId) sectionXML += " RefId='" + section.refId + "'";
          sectionXML += ">";
          for( var k = 0 ; k < section.content.length ; ++k ){
             sectionXML += generateTag(section.content[k]);
          }
          sectionXML += "</Paragraph>";
          allChaptersXML += sectionXML;
        }
      }
      //appendAllChildren( sectionXML, xmlDoc.getElementsByTagName("doc_content")[0]);
      appendAllChildren( allChaptersXML, xmlDoc.getElementsByTagName("doc_content")[0]);
      
      return (new XMLSerializer()).serializeToString(xmlDoc);
    }
  }
})();