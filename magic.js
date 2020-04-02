window.onload=function(){
	var consoleOut = $('.console-output').text()
    var menus;
    var referral='';
	var menu =  $('<div/>', {class: 'topnav', id : 'myTopnav'})
    var dropdown = $('<div/>', {class: 'dropdown'}) .append('<button  class="dropbtn">Tests Cases Navigator <i class="fa fa-caret-down"></i></button>')
    var uldropdown = $('<div/>', {class: 'dropdown-mycontent'});
	$('.console-output').html('')
    var preString = "Starting TestCase:",postString = "SUMMARY of TestCase ["
	var prestringLength = preString.length
	var console = consoleOut.split("\n")
	var testname='',href='',color='',line
	var colors = {'ERROR':'style="color:#F90636;"','INFO':'style="color:#061CF9;"','DEBUG':'style="color:#C906F9;"','WARN':'style="color:#F97106;"'}
	$.each( console , function(t, tmp ){
		color = ''
		for (var key in colors) {
			if (tmp.indexOf(key) !=-1) {
				color = colors[key]
				break;
			}
		}
		var preIndex = tmp.indexOf(preString),postIndex = tmp.indexOf(postString);
		line = '<span class="testline" '+color+'">' + tmp + '</span>'
        if (preIndex != -1) {
		    testname = tmp.substring(preIndex + prestringLength, tmp.length)	
			href= '#test'+t
			line = '<span class="testline" '+color+'" id="test' + t + '">' + tmp + '</span>'
        }
		if (postIndex != -1) {
			menus = (tmp.indexOf('ERROR') != -1 ? '<span style="color:#F90636">' + testname + '</span>' : '<span style="color:#2ACF1F">' + testname + '</span>');
			uldropdown.append('<button><a href="' + href + '">' + menus + '</a></button>')
		}
		$('.console-output').append(line+"<br />")
	})
	dropdown.append(uldropdown);
	menu.append(dropdown) 
	$('.top-sticker-inner').append(menu)
	$('.topnav').append('<button class="download btn button">Download logs</button>')
	var title = document.title;
	$(document).on('click', '.download', function (){
			var filename = title+".txt"
            var tempElem = document.createElement('a');
            tempElem.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(consoleOut));
            tempElem.setAttribute('download', filename);
            tempElem.click();
         })
}