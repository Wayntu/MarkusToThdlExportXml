var MarkusToSTAMLFuncs = (function(){
	var metadataTable = [
		{ from: "/div[@class='doc']/@filename", to: "filename"}
	];

	var applicationTable = [
		{ from: "/div[@class='doc']/@tag", to: "tag"}
	];

	var sectionDividerTable = {
		chapter: false,
		section: "/div[@class='doc']/pre/span[@type='passage']"
	}

	var tagTable = [
		{ type: "person", tag: "//span[@type='fullName']",
		    linkdata: [ { from: "/span/@cbdbid", to: "CbdbId"} ]},                     // 2017-03-28: change 'cbdbid' to "CbdbId"
		{ type: "person", subtype: "othername", tag: "//span[@type='partialName']",
		    linkdata: [ { from: "/span/@cbdbid", to: "CbdbId"} ]},
      { type: "person", subtype: "ddbcPerson", tag: "//span[@type='ddbcPerson']",    // 2017-03-22: Markus 未將此 tag 放入前置宣告區？
		    userdata: [ { from: "/span/@ddbcperson_id", to: "note"} ]},
      { type: "location", tag: "//span[@type='placeName']",
		    userdata: [ { from: "/span/@placename_id", to: "note"} ]},                  // 又霖將 xxxx_id 的內容，放入 note 中...
		{ type: "specificTerm", subtype: "officialTitle", tag: "//span[@type='officialTitle']",
		    userdata: [ { from: "/span/@officialtitle_id", to: "note"} ]},
		{ type: "datetime",  tag: "//span[@type='timePeriod']",
		    userdata: [ { from: "/span/@timeperiod_id", to: "note"} ]},
		//{ type: "DocTitle", tag: "//span[@type='title']" },
	   //{ type: "recipe",  tag: "//span[@type='Recipe']",
	   //   userdata: [ { from: "/span/@recipe_id", to: "note"} ]},
      //{ type: "drugname",  tag: "//span[@type='DrugName']",
      //   userdata: [ { from: "/span/@drugname_id", to: "note"} ]},
      { type: "comments", tag: "//span[@class='commentContainer']",
           userdata: [ { from: "/span/@value", to "note"} ]}
	];

	var tagIgnore = [
		//"/span[@class='commentContainer']"
	];

	var XMLTableToJSON  = function( table ){
		return function(context){
			var jsonData= {};
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");

			for( var i = 0 ; i < table.length ; i++ ){
				if( table[i].key ){
					jsonData[table[i].key] = table[i].value;
					continue;
				}
				var nodes = xmlDoc.evaluate(table[i].from, xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
				jsonData[table[i].to] = [];
				var node;
				while( node = nodes.iterateNext() ){
					if( node.nodeType === 1 ){
						jsonData[table[i].to] = node.textContent;
					}
					else if( node.nodeType === 2 ){
						jsonData[table[i].to] = node.value;
					}
					else if( node.nodeType === 3 ){
						jsonData[table[i].to] = node.nodeValue;
					}
				}

				if( jsonData[table[i].to].length === 1 ){
					jsonData[table[i].to] = jsonData[table[i].to][0];
				}

				if( jsonData[table[i].to].length === 0 ){
					delete jsonData[table[i].to];
				}
			}

			return jsonData;
		};
	}
	
	var tagTransformer = function( context ){
			var content = [];
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");

         // nodeType: 1 Element, 2 Attribute, 3 Text, 4 CDATASection, 5 EntityReference
         //           6 Entity, 7 ProcessingInstruction, 8 Comment, 9 Document
         //           10 DocumentType, 11 DocumentFragment, 12 Notation
			var nodes = xmlDoc.firstChild.childNodes;
			for( var i = 0 ; i < nodes.length ; i++ ){
				if( nodes[i].nodeType === 3 ){
					content.push( nodes[i].nodeValue );
				}
				else if( nodes[i].nodeType === 1 ){
					var node = createXMLDocumentFromNode(nodes[i]);
					var ignore = false;
					for( var j = 0 ; j < tagIgnore.length ; j++ ){
						if( node.evaluate(tagIgnore[j], node, null, XPathResult.ANY_TYPE, null).iterateNext() ){
							ignore = true;
							break;
						}
					}
					if( !ignore ) {     // 2017-04-07: Tu fix (recursiveXML can return an array)
                  var result = recursiveXML(node);
                  if (Array.isArray(result)) {
                     content.push.apply(content, result);
                  }
                  else content.push( result );
               }
				}
			}

         //alert(JSON.stringify(content));
			return content;
		}

	var recursiveXML = function( node ){
		var content = {};
		var last = content;
		var now = content;
		var allTag = 0;
		// nodeType 1:element, 2:attribute, 3:text
		//for(var child = node.childNodes[0]; child.nodeType !== 3 ; child = child.childNodes[0]){
		//for (var child = node.childNodes[0]; child && child.nodeType !== 3 ; child = child.childNodes[0]) {
		//for(var child = node.childNodes[0]; child.nodeType === 1 ; child = child.childNodes[0]){
		//	++allTag;
		//}
      var myNodes = node.getElementsByTagName("*");
      allTag = myNodes.length;
      
      if (allTag > 1) {
         var firstChild = node.firstChild;
         var tagType = firstChild.tagName;     // 暫時先取 tagName 作為 tagType...
         var childNodes = firstChild.childNodes;
         var contentList = [];
         for (var i=0; i<childNodes.length; i++) {
            if (childNodes[i].nodeType == 1) {
               var myNode = createXMLDocumentFromNode(childNodes[i]);
               contentList[i] = recursiveXML(myNode);
            }
            else if (childNodes[i].nodeType == 3) {
               contentList[i] = childNodes[i].textContent;
            }
         }
         return { type: tagType,
                  content: contentList
                  };
      }

		var foundTag = 0;
		for (var i = 0 ; i < tagTable.length ; i++) {
			var tags = node.evaluate( tagTable[i].tag, node, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
         var tag;
			while (tag = tags.iterateNext()) {
	         //alert(tag.nodeType + ':' + JSON.stringify(tag.textContent) + "\n" +
            //      tagTable[i].tag + ' ' + (new XMLSerializer()).serializeToString(tag) );
				++foundTag;
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
					if( Object.keys(now.linkdata).length === 0 ) {
						now.linkdata = undefined;
						delete now.linkdata;
					}
				}
            
				last = now;               // referece to the previous result
				now.content = {};         // create a deeper sub-object
				now = now.content;        // move object reference to deeper sub-object 
			}
		}
      //alert(allTag + ' - Wrapup: ' + JSON.stringify(content));
		
		//console.log( content, allTag, foundTag );
		if( allTag !== foundTag ){
			var lastNode = null;
			var diff = allTag - foundTag;
			var nowFoundTag = 0;
			var child;
			// 2017-01-18: should check if child is not null (i.e., child && ...)
			for( child = node.childNodes[0] ; child && child.nodeType !== 3 ; child = child.childNodes[0]){
				for( var i = 0 ; i < tagTable.length ; i++ ){
					var tags = node.evaluate( tagTable[i].tag, child, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
					var tag;
					
					while( tag = tags.iterateNext() ){
						++nowFoundTag;
					}		
				}
				
				if( allTag - nowFoundTag !== diff ){
					//console.log( lastNode );
					now.type = lastNode.nodeName;
					if( lastNode.getAttribute("subtype") ){
						now.subtype = lastNode.getAttribute("subtype");
					}
					
					diff = allTag - nowFoundTag;
					
					last = now;
					now.content = {};
					now = now.content;
				}			
				lastNode = child;
				--allTag;
			}
			
			if( diff > 0 ){
				now.type = lastNode.nodeName;
				if( lastNode.getAttribute("subtype") ){
					now.subtype = lastNode.getAttribute("subtype");
				}
				
				diff = allTag - nowFoundTag;
				
				last = now;
				now.content = {};
				now = now.content;
			}
		}

		last.content = node.firstChild.textContent;
      //alert('last: ' + node.firstChild.nodeType + ': ' + JSON.stringify(last.content));
		return content;         // content and last reference to the same object!
	}
	
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
			if(attr[i].nodeName === "style" || attr[i].nodeName === "id"){
				continue;
			}
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

	var generateTag = function( object ){
		if( String.isString(object) ) return object;
		var tag = '<span class="' ;
		var tagName, moreThanOneIdData, moreThanOneIdAttribute;
		if( object.type === "person" ){
			if( object.subtype === "othername" ){
				tagName = "partialName";
				moreThanOneIdData = "linkdata";
				moreThanOneIdAttribute = "CbdbId";       // 2017-03-28: from "cbdbid" to "CbdbId"
			}
			else if( object.subtype === "officialTitle" ){
				tagName = "officialTitle";
				moreThanOneIdData = "userdata";
				moreThanOneIdAttribute = "note";
			}
			else {
				tagName = "fullName";
				moreThanOneIdData = "linkdata";
				moreThanOneIdAttribute = "CbdbId";       // 2017-03-28: from "cbdbid" to "CbdbId"
			}
		}
		else if(object.type === "location"){
			tagName = "placeName";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else if(object.type === "datetime"){
			tagName = "timePeriod";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else if(object.type === "drugname"){
			tagName = "drugName";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else if(object.type === "recipe"){
			tagName = "recipe";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else {
		   // check if object.type is "Udef_xxx"...
		   var s = object.type;
		   var ret = '';
		   if (s.substr(0,5) === 'Udef_') {
            tagName = s.substr(5);
	         moreThanOneIdData = "userdata";
            moreThanOneIdAttribute = "note";
		   }
		   else {
            return "<" + object.type + ((object.subtype)? " subtype = '" + object.subtype + "'": "")+ ">" +  object.content + "</" + object.type + ">";
		   }
		}

		tag += tagName + " markup unsolved";
		if( object[moreThanOneIdData] && object[moreThanOneIdData] [moreThanOneIdAttribute] && object[moreThanOneIdData] [moreThanOneIdAttribute] .split("|").length > 1 ){
			tag += " moreThanOneId";
		}
		tag += '" type="' + tagName + '"';
		if( object.linkdata ){
			for( var key in object.linkdata ){
				if( key === "refID" ){
					continue;
				}
				tag += " " + key + '="' + object.linkdata[key] + '"';
			}
		}

		if( object.userdata ){
			for( var key in object.userdata ){
				if( key === "note" ){
					tag += " " + tagName.toLowerCase() + '_id="' + object.userdata[key] + '"'
				}
				else if( key === "refID" ){
					continue;
				}
				else {
					tag += " " + key + '="' + object.userdata[key] + '"';
				}
			}
		}

		tag += ">";
		//console.log( tag );

		if( String.isString(object.content) ){
			tag += object.content;
		}
		else {
			tag += generateTag(object.content);
		}

		tag += "</span>"

		return tag;
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
			if( key === "#text" ) continue;
			xmlString += "<" + key + ">" + objectToXML(object[key]) + "</" + key + ">";
		}
		return xmlString;
	}
	
	function appendCustomizedTags(customizedTags) {        // Tu
		//{ type: "recipe",  
		//  tag: "//span[@type='Recipe']",
		//  userdata: [ { from: "/span/@recipe_id", to: "note"} ]}
	   var tagHash = {};
	   for (var i=0; i<tagTable.length; i++) {
	      //var type = tagTable[i].type;
	      var tagPath = tagTable[i].tag;
	      var regex = /\/\/span\[@type='(.+)'\]/g;
	      var tag = regex.exec(tagPath)[1];
	      tagHash[tag] = 1;
	   }
	   for (var tag in customizedTags) {           // 將 Markus html 的 <span type="xxx"> 轉成 <Udef_xxx> 
	      if (!tagHash[tag]) {
	         var tagType = 'Udef_' + tag;          // 在 ThdlExportXml 的標籤名稱，為 Udef_<tag>
	         var tagPath = "//span[@type='" + tag + "']";
	         var udataFrom = "/span/@" + tag.toLowerCase() + "_id";
	         var entry = { type: tagType,
	                       tag: tagPath,
	                       userdata: [ { from: udataFrom, to: "note"} ]
	                     };
            tagTable.push(entry);
            tagHash[tag] = 1;
         }
	   }
	   //alert(JSON.stringify(tagTable));
	}

	return {
		documentInformation: function( context ){
			//var metadataTransform = XMLTableToJSON(metadataTable);
			var applicationTransform = XMLTableToJSON(applicationTable);
			var dom = tryParseXML(context);             // 2016-09-16
			if (dom === null) return null;
			metaHidden = (dom) ? dom.getElementById("metadataHidden") : null;
			//var metaHidden = (new DOMParser()).parseFromString(context, "text/xml").getElementById("metadataHidden");

			// Tu: 2017-01-19 firstChild <div ... tag="...">
			var customizedTags = (s = dom.firstChild.getAttribute("tag")) ? JSON.parse(s) : {};
			appendCustomizedTags(customizedTags);
			
			return {
				metadata: (metaHidden)? XMLtoObject(metaHidden) : {filename: (new DOMParser()).parseFromString(context, "text/xml").getElementsByClassName("doc")[0].getAttribute("filename") },
				application: applicationTransform(context),
			};
		},
		articleInformation: function( context ){      // get the "article" information from context (e.g., Markus html)
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");
			var metaHidden = xmlDoc.getElementById("metadataHidden");
			if( metaHidden ) metaHidden.parentNode.removeChild( xmlDoc.getElementById("metadataHidden") );
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
				if( chapters.length === 1 && (node = nodes.iterateNext()) === null ){
					nodes = xmlDoc.evaluate("/div[@class='doc']/pre", xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
					node = nodes.iterateNext();
				}

				do {
					if( node ){
						var node = (new DOMParser()).parseFromString( (new XMLSerializer()).serializeToString(node), "text/xml" );
						if( node.getElementById("metadataHidden") ) continue;
                  // node is of "Document" type (nodeType == 9)
                  var nodeXml = (new XMLSerializer()).serializeToString(node);
                  //alert(JSON.stringify(nodeXml));
                  // tagTransformer 只處理當前 tag （例如 <span type="passage" id="...">）之下的內容，因此 type, id 之類的屬性，必須提前取得
                  var typeValId = node.firstChild.getAttribute("id");    // 如果 passage 沒有 id 屬性，就會是 null
                  var transformedContent = tagTransformer(nodeXml);    
						sections[i].content.push({ type: "section", typeValId: typeValId, content: transformedContent });
					}
				} while( node = nodes.iterateNext() );
			}

         //alert(JSON.stringify(sections));
			return sections;
		},

		mergeToContext: function( input ){
			var metadata = input.document.metadata;
			var sections = input.article;
			var application = input.document.application;

			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString( "<div class='doc'><pre></pre></div>" ,"text/xml");

			// metadata
			var rootNode = xmlDoc.evaluate("/div[@class='doc']", xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null).iterateNext();

			var filename = xmlDoc.createAttribute("filename");
			filename.value = metadata.filename;
			rootNode.setAttributeNode(filename);

			// application
			if( application ){
					if( application.tag ){
						var tag = xmlDoc.createAttribute("tag");
						tag.value = application.tag;
						rootNode.setAttributeNode(tag);
					}
			}

			// sections
			var sectionNumber = 0;
			for( var i = 0 ; i < sections.length ; i++ ){
				
				for( var j = 0 ; j < sections[i].content.length ; j++, sectionNumber++ ){
					var section = '<span class="passage" type="passage" id="passage' + sectionNumber + '"><span class="commentContainer" value="[]"><span class="glyphicon glyphicon-comment" type="commentIcon" style="display:none" aria-hidden="true" data-markus-passageid="passage' + sectionNumber + '"></span></span>';
					for( var k = 0 ; k < sections[i].content[j].content.length ; k++ ){
						section += generateTag( sections[i].content[j].content[k] );
					}
					section += "</span>\n\n";
					appendAllChildren( section, xmlDoc.getElementsByTagName("div")[0].getElementsByTagName("pre")[0] );
				}
			}

			var metadataNode = xmlDoc.createElement("div");
			metadataNode.setAttribute("id", "metadataHidden");
			metadataNode.setAttribute("style", "display: none");
			//console.log(metadata);
			appendAllChildren( objectToXML(metadata), metadataNode );
			xmlDoc.getElementById("passage0").appendChild( metadataNode );

			return (new XMLSerializer()).serializeToString(xmlDoc) ;
		}
	};
})();
