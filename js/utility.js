String.prototype.escape = function() {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };
    return this.replace(/[&<>]/g, function(tag) {
        return tagsToReplace[tag] || tag;
    });
};

if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

if( !String.isString ){
    String.isString = function(val) {
        return typeof val === 'string' || ((!!val && typeof val === 'object') && Object.prototype.toString.call(val) === '[object String]');
    }
}

var appendAllChildren = function( nodeString, nodeTo ) {
    var parser = new DOMParser();
    var xmlTemp = parser.parseFromString("<append>" + nodeString + "</append>", "text/xml");
    //console.log( (new XMLSerializer()).serializeToString(xmlTemp) );
    var nodeFrom = xmlTemp.getElementsByTagName("append")[0];
    if (!nodeFrom) alert(saveXml(xmlTemp));    // 通常是 xml 語法錯誤
    if( nodeFrom.getElementsByTagName("refID")[0] !== undefined ){
        var id = xmlTemp.createAttribute("refID");
        id.value = nodeFrom.getElementsByTagName("refID")[0].textContent;
        nodeFrom.childNodes[0].setAttributeNode(id);
        nodeFrom.childNodes[0].removeChild(nodeFrom.getElementsByTagName("refID")[0]);
    }

    while( nodeFrom.hasChildNodes() ){
        nodeTo.appendChild(nodeFrom.removeChild(nodeFrom.firstChild));
    }
    
    
}

var createXMLDocumentFromNode = function( node ){
   //return (new DOMParser()).parseFromString( (new XMLSerializer()).serializeToString(node), "text/xml");
   return loadXml(saveXml(node));
}

Date.prototype.yyyymmdd = function() {  // Tu: copied from Web
  var mm = this.getMonth() + 1;         // getMonth() is zero-based
  var dd = this.getDate();
  return this.getFullYear() + ('0'+mm).substr(-2) + ('0'+dd).substr(-2);  // padding
}

var loadXml = function(xml) {          // Tu
   return (new DOMParser()).parseFromString(xml, "text/xml");
}

var saveXml = function(xmlNode) {      // Tu
   return (new XMLSerializer()).serializeToString(xmlNode);
}

