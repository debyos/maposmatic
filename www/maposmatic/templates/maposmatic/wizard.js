{% comment %}
 coding: utf-8

 maposmatic, the web front-end of the MapOSMatic city map generation system
 Copyright (C) 2012  David Decotigny
 Copyright (C) 2012  Frédéric Lehobey
 Copyright (C) 2012  Pierre Mauduit
 Copyright (C) 2012  David Mentré
 Copyright (C) 2012  Maxime Petazzoni
 Copyright (C) 2012  Thomas Petazzoni
 Copyright (C) 2012  Gaël Utard

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as
 published by the Free Software Foundation, either version 3 of the
 License, or any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
{% endcomment %}
{% load i18n %}
{% load extratags %}

/**
 * Map creation wizard.
 */

var BBOX_MAXIMUM_LENGTH_IN_KM = {{ BBOX_MAXIMUM_LENGTH_IN_METERS }} / 1000;

var locationFilter = null;
var map = wizardmap($('#step-location-map'));
var country = null;
var languages = $('#id_map_language').html();

jQuery.fn.reverse = [].reverse;

function dd2dms(value, d1, d2) {
    value = parseFloat(value);
    var abs_value  = Math.abs(value);
    var degrees    = Math.floor(abs_value);
    var frac       = abs_value - degrees;
    var minutes    = Math.floor(frac * 60);
    var seconds    = Math.round((frac * 3600) % 60);

    return degrees + "°" + minutes + "'" + seconds + '"' + ((value > 0) ? d1 : d2);
}

$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
  $('#id_administrative_city').val('');
  $('#id_administrative_osmid').val('');
  country = null;

  switch(e.target.id) {
  case 'step-location-admin-tab':
    // If we're switching to the administrative boundary / city search tab, reset
    // the focus inside the input field.
    $('#id_administrative_city').focus();
    break;
  case 'step-location-bbox-tab':
    // trigger map location update via "moveend" event by fake move
    map.panBy([ 1,  1]);
    map.panBy([-1, -1]);
    break;
  }

  setPrevNextLinks();
});

function setPrevNextLinks() {
  var current = $('#step-location-tabs div.item.active');
  var first   = $('#step-location-tabs div.item:first-child');
  var last    = $('#step-location-tabs div.item:last-child');

  $('#prevlink').hide();
  $('#nextlink').hide();
  if (current.attr('id') == first.attr('id')) {
    if ($('#id_administrative_osmid').val()) {
      $('#nextlink').show();
    }
  } else if (current.attr('id') == last.attr('id')) {
    $('#prevlink').show();
  } else {
    $('#prevlink').show();
    $('#nextlink').show();
  }
}


function lonAdjust(lon) {
  while (lon > 180.0)  lon -= 360.0;
  while (lon < -180.0) lon += 360.0;
  return lon;
}

function metric_dist(lat1, lon1, lat2, lon2)
{
    var c = Math.PI/180.0;
    var r1 = lat1 * c;
    var r2 = lat2 * c;
    var th = lon1 - lon2;
    var radth = th * c;
    var dist = Math.sin(r1) * Math.sin(r2) + Math.cos(r1) * Math.cos(r2) * Math.cos(radth);
    if (dist > 1) dist = 1;
    return Math.acos(dist) * 10000 / 90;
}




function wizardmap(elt) {
  var map = create_map($('#step-location-map'));
  var lock = false;
  var bbox = null;
  var bbox_style = {
    fill: true,
    fillColor: "#FFFFFF",
    fillOpacity: 0.5,
    stroke: true,
    strokeOpacity: 0.8,
    strokeColor: "#FF0000",
    strokeWidth: 2
  };
  var countryquery = null;
  locationFilter = new L.LocationFilter({buttonPosition: 'topright'});
  locationFilter.on("change", function (e) {
      bbox = e.target.getBounds();
      map.fitBounds(bbox);
      update_fields();
  });
  locationFilter.on("enabled", function (e) {
      bbox = e.target.getBounds();
      map.fitBounds(bbox);
      update_fields();
  });
  locationFilter.on("disabled", function (e) {
      bbox = null;
      update_fields();
  });
  locationFilter.addTo(map);

  // locate client position
  L.control.locate().addTo(map);

  // search button
  map.addControl( new L.Control.Search({
      url: '//nominatim.openstreetmap.org/search?format=json&q={s}',
      jsonpParam: 'json_callback',
      propertyName: 'display_name',
      propertyLoc: ['lat','lon'],
      circleLocation: true,
      markerLocation: false,
      autoType: false,
      autoCollapse: true,
      minLength: 2,
      zoom: 17
  }) );

  /**
   * Update the 4 text fields with the area coordinates.
   *
   * If a feature has been drawned (bbox != null), the bounding box of the
   * feature is used, otherwise the map extent is used.
   */
  var update_fields = function() {
    if (lock) {
      return;
    }

    var bounds = (bbox != null) ? bbox : map.getBounds();

    $('#id_lat_upper_left').val(bounds.getNorth().toFixed(4));
    $('#id_lon_upper_left').val(lonAdjust(bounds.getWest()).toFixed(4));
    $('#id_lat_bottom_right').val(bounds.getSouth().toFixed(4));
    $('#id_lon_bottom_right').val(lonAdjust(bounds.getEast()).toFixed(4));

    var center = bounds.getCenter();

    var upper_left   = bounds.getNorthWest();
    var upper_right  = bounds.getNorthEast();
    var bottom_left  = bounds.getSouthWest();
    var bottom_right = bounds.getSouthEast();

    var width  = upper_left.distanceTo(upper_right);
    var height = upper_right.distanceTo(bottom_right);

    var rounded_width = Math.round(width);
    var rounded_height = Math.round(height);
    var unit = "m²";

    if (rounded_width > 1000 && rounded_height > 1000) {
      rounded_width = Math.round(width / 1000);
      rounded_height = Math.round(height / 1000);
      unit = " km²";
    }
    $('#lat_upper_left_info').text(   dd2dms(bounds.getNorth(), 'N', 'S') );
    $('#lon_upper_left_info').text(   dd2dms(bounds.getWest(),  'E', 'W') );
    $('#lat_bottom_right_info').text( dd2dms(bounds.getSouth(), 'N', 'S') );
    $('#lon_bottom_right_info').text( dd2dms(bounds.getEast(),  'E', 'W') );
    $('#metric_info').text(
	'( ca. ' + rounded_width + ' x ' + rounded_height + unit + ')'
    );

    var osmid = $('#id_administrative_osmid').val();
    if (osmid) {
      $('#area-size-alert').hide();
      $('#nextlink').show();
    } else if (width < {{ BBOX_MAXIMUM_LENGTH_IN_METERS }} &&
               height < {{ BBOX_MAXIMUM_LENGTH_IN_METERS }}) {
      $('#area-size-alert').hide();
      $('#nextlink').show();

      // Attempt to get the country by reverse geo lookup
	if (countryquery != null) {
	    countryquery.abort();
	}

	countryquery = $.getJSON(
        '/apis/reversegeo/' + center.lat + '/' + center.lng + '/',
        function(data) {
          $.each(data, function(i, item) {
            if (typeof item.country_code != 'undefined') {
              country = item.country_code;
            }
          });
        });
    } else {
      $('#area-size-alert').show();
      $('#nextlink').hide();
    }
  };

  /**
   * Set the map bounds and extent to the current values given by the 4 text
   * fields.
   */
  var set_map_bounds_from_fields = function() {
    lock = true;
    set_map_bounds(map, [
      [$('#id_lat_upper_left').val(), $('#id_lon_upper_left').val()],
      [$('#id_lat_bottom_right').val(), $('#id_lon_bottom_right').val()]
    ]);
    lock = false;
  };


  // Bind events.
  map.on('moveend', update_fields);
  map.on('zoomend', update_fields);

  $('#step-location-bbox input').bind('keydown', function(e) {
    if (bbox) {
      return;
    }

    if (e.keyCode == 38 || e.keyCode == 40) {
      var v = parseFloat($(e.target).val()) + (0.01 * (e.keyCode == 38 ? 1 : -1));
      $(e.target).val(v.toFixed(4));
    }

    set_map_bounds_from_fields();
    update_fields();
  });

  update_fields();
  return map;
}

/* general file upload event handler */
function loadFile(input, onload_func) {
  var file, fr;
  if (typeof window.FileReader !== 'function') {
    console.log("The file API isn't supported on this browser yet.");
    return;
  }
  if (!input) {
    console.log("Um, couldn't find the fileinput element.");
  }
  else if (!input.files) {
    console.log("This browser doesn't seem to support the `files` property of file inputs.");
  }
  else if (!input.files[0]) {
    console.log("Please select a file before clicking 'Load'");
  }
  else {
    file = input.files[0];
    fr = new FileReader();
    fr.onload = receivedText;
    fr.readAsText(file);
  }
  function receivedText() {
    onload_func(fr.result);
  }
}

/* handle upload of GPX files*/
$("#id_track").change(function() {
  loadFile($("#id_track")[0], function(xml) {
    if (/Trident\/|MSIE/.test(window.navigator.userAgent)) {
      // InterNet Explorer 10 / 11
      xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
      xmlDoc.async = false;
      xmlDoc.loadXML(xml);
      if (xmlDoc.parseError.errorCode!=0) {
	alert("not a valid XML file");
	$("#id_track")[0].value = '';
        return false;
      }
    } else {
      var parser = new DOMParser();
      var parsererrorNS = parser.parseFromString('INVALID', 'text/xml').getElementsByTagName("parsererror")[0].namespaceURI;
      var dom = parser.parseFromString(xml, 'text/xml');
      if(dom.getElementsByTagNameNS(parsererrorNS, 'parsererror').length > 0) {
	alert("not a valid XML file");
	$("#id_track")[0].value = '';
	return false;
      }
    }

    var gpx = new L.GPX(xml, { async: false,
                     marker_options: {
                       wptIconUrls: {
                         '':'/media/bower/leaflet-gpx/pin-icon-wpt.png',
                       },
                       startIconUrl: false,
                       endIconUrl: false,
                       shadowUrl: false
                     }
                   }
              ).addTo(map);

     var new_bbox = gpx.getBounds();

     if ('_northEast' in new_bbox === false) {
       alert("Not a GPX file");
       $("#id_track")[0].value = '';
       return false;
     }

     $('#step-location-bbox').tab('show') // Select geo location tab
     $('#id_maptitle').val(gpx.get_name());

     new_bbox = new_bbox.pad(0.1)
     map.fitBounds(new_bbox);
     locationFilter.setBounds(new_bbox);
     locationFilter.enable();

     return true;
  });
});

// TODO - this shouldn't be hardcoded, but read from the config file instead
var umap_style_mapping = {
    "OpenStreetMap"            : "CartoOsm",
    "OSM-monochrome"           : "CartoOsmBw",
    "OSM Humanitarian (OSM-FR)": "Humanitarian",
    "OSM-Fr"                   : "French",
    "OSM hikebikemap"          : "HikeBikeMap",
    "OSM Deutschland (OSM-DE)" : "GermanCartoOSM",
    "OSM OpenTopoMap"          : "OpenTopoMap",
    "OSM OpenRiverboatMap"     : "OpenRiverboatMap",
    "OSM Toner (Stamen)"       : "Toner"
};

/* handle upload of UMAP files*/
$("#id_umap").change(function() {

    loadFile($("#id_umap")[0], function(umap) {
	var umap_json, layer, feature;
	var new_features = []

	try {
	    umap_json = JSON.parse(umap);
	} catch(e) {
	    alert('This does not look like a valid Umap export file (json parse error)');
	    $("#id_umap")[0].value = '';
	    return false;
	}

	if (! (umap_json.type == 'umap')) {
	    alert('This does not look like a valid Umap export file (wrong or missing type info)');
	    $("#id_umap")[0].value = '';
	    return false;
	}

	for (layer in umap_json.layers) {
	    for (feature in umap_json.layers[layer].features) {
		new_features.push(umap_json.layers[layer].features[feature]);
	    }
	}

	var new_geojson = {'type': 'FeatureCollection', 'features': new_features};

	var json_layer = L.geoJson(new_geojson).addTo(map);
	var new_bbox = json_layer.getBounds();

	if ('_northEast' in new_bbox === false) {
	    alert('Umap file contains no geometry data');
	    $("#id_umap")[0].value = '';
	    return false;
	}

	$('#step-location-bbox').tab('show') // Select geo location tab
	$('#id_maptitle').val(umap_json.properties.name);

	var umap_title;
	try {
	    umap_title = umap_json.properties.tilelayer.name;
	} catch (err) {
	    umap_title = "OSM-Fr";
	}
	if (umap_title in umap_style_mapping) {
	    $("input:radio[name=stylesheet][value='"+umap_style_mapping[umap_title]+"']").prop("checked",true);
	}

	map.fitBounds(new_bbox);

	if (new_bbox.getSouthWest().equals(new_bbox.getNorthEast())) {
	    new_bbox = map.getBounds();
	}

	new_bbox = new_bbox.pad(0.1);
	locationFilter.setBounds(new_bbox);
	locationFilter.enable();

	return true;
    });
});


var currentTab = 0; // Current tab is set to be the first tab (0)
showTab(currentTab); // Display the current tab

function showTab(n) {
  // This function will display the specified tab of the form ...
  var x = document.getElementsByClassName("tab");
  x[n].style.display = "block";

  // ... and fix the Previous/Next buttons:
  if (n == 0) {
    $("#prevlink").hide();
  } else {
    $("#prevlink").show();
  }
  if (n == (x.length - 1)) {
    $("#nextlink").hide();
    $("#formsubmit").show();
  } else {
    if ($("#area-size-alert").is(":visible")) {
      $("#nextlink").hide();
    } else {
      $("#nextlink").show();
    }
    $("#formsubmit").hide();
  }

  x = document.getElementsByClassName("btn-circle");
  var i;

  for (i = 0; i < x.length; i++) {
    if (i == n) {
      x[i].classList.add("active");
    } else {
      x[i].classList.remove("active");
    }
  }
}

function nextPrev(n) {
  // This function will figure out which tab to display
  var x = document.getElementsByClassName("tab");

  // Exit the function if any field in the current tab is invalid:
  if (n == 1 && !validateForm()) return false;

  // Hide the current tab:
  x[currentTab].style.display = "none";

  // Increase or decrease the current tab by 1:
  currentTab = currentTab + n;

  tabName = x[currentTab].id;

  switch(tabName) {
    case 'wizard-step-paper-size':
      preparePaperSize();
      break;
    case 'wizard-step-lang-title':
      prepareLangTitle();
      break;
  }

  // if you have reached the end of the form... :
  if (currentTab >= x.length) {
    //...the form gets submitted:
    document.getElementById("regForm").submit();
    return false;
  }
  // Otherwise, display the correct tab:
  showTab(currentTab);
}

function validateForm() {
  return true;
}

function preparePaperSize() {
  $('#paper-selection').hide();
  $('#paper-size-loading-error').hide();
  $('#paper-size-loading').show();
  $('#nextlink').hide();

  var args = null;
  if ($('#id_administrative_osmid').val()) {
    args = {
      osmid: $('#id_administrative_osmid').val(),
    };
  } else {
    args = {
      lat_upper_left: $('#id_lat_upper_left').val(),
      lon_upper_left: $('#id_lon_upper_left').val(),
      lat_bottom_right: $('#id_lat_bottom_right').val(),
      lon_bottom_right: $('#id_lon_bottom_right').val()
    };
  }

  args['layout'] = $('input[name=layout]:checked').val();
  args['stylesheet'] = $('input[name=stylesheet]:checked').val();
  if (!args['stylesheet']) {
      args['stylesheet'] = $('#id_stylesheet :selected').val();
  }
  args['overlay'] = $('input[name=overlay]:checked').val();
  if (!args['overlay']) {
      args['overlay'] = $('#id_overlay :selected').val();
  }

  $.ajax('/apis/papersize/', { type: 'post', data: args })
    .complete(function() { $('#paper-size-loading').hide(); })
    .error(function() { $('#paper-size-loading-error').show(); })
    .success(function(data) {

      function get_paper_def(paper) {
        for (i in data) {
          if (paper == data[i][0]) {
            return data[i];
          }
        }

        return null;
      }

      function handle_paper_size_click(w, h, p_ok, l_ok, l_preferred) {
        var l = $('#paper-selection input[value=landscape]');
        var p = $('#paper-selection input[value=portrait]');

        if (l_ok) {
          l.removeAttr('disabled');
          if (!p_ok) { l.attr('checked', 'checked'); }
        } else {
          l.attr('disabled', 'disabled');
          p.attr('checked', 'checked');
        }

        if (p_ok) {
          p.removeAttr('disabled');
          if (!l_ok) { p.attr('checked', 'checked'); }
        } else {
          p.attr('disabled', 'disabled');
          l.attr('checked', 'checked');
        }

        if (l_ok && p_ok) {
          if (l_preferred) {
            l.attr('checked', 'checked');
          } else {
            p.attr('checked', 'checked');
          }
        }
        $('#id_paper_width_mm').val(w);
        $('#id_paper_height_mm').val(h);
      }

      var default_paper = null;

      $.each($('#paper-size ul li'), function(i, item) {
        $(item).hide();

        var paper = $('label input[value]', item).val();
        var def = get_paper_def(paper);
        if (def) {
          $('label', item).bind('click', function() {
            handle_paper_size_click(def[1], def[2], def[3], def[4], def[6]);
          });

          if (def[5]) {
            default_paper = $(item);
          }

          $(item).show();

          // TODO: fix for i18n
          if (paper == 'Best fit') {
            w = def[1] / 10;
            h = def[2] / 10;
            $('label em.papersize', item).html('(' + w.toFixed(1) + ' &times; ' + h.toFixed(1) + ' cm²)');
          }
        }
      });

      $('label input', default_paper).click();
      $('#paper-selection').show();
      $('#nextlink').show();
    });
}

function country_lang(country_code)
{
    var list    = $('#maplang_choices');
    var success = 0;

    list.children('a').each(function() {
	var langcode = $(this)[0].dataset.langcode;
	if (langcode.substring(3,5) == country_code.toUpperCase()) {
	    $('#map_language_button').html($(this).html());
	    $('#{{ form.map_language.name }}').val($(this)[0].dataset.langcode);
	    success = 1;
	    return false;
	}
    });

    if (!success) {
	list.children('a').each(function() {
	    var langcode = $(this)[0].dataset.langcode;
	    if (langcode == "C") {
		$('#map_language_button').html($(this).html());
		$('#{{ form.map_language.name }}').val('C');
		return false;
	    }
	});
    }
}

function prepareLangTitle() {
  // Prepare the language list
  country_lang(country);

  // Seed the summary fields
  if ($('#id_administrative_osmid').val()) {
    $('#summary-location').text($('#id_administrative_city').val());
  } else {
      var tl = L.latLng($('#id_lat_upper_left').val(), $('#id_lon_upper_left').val());
      var br = L.latLng($('#id_lat_bottom_right').val(), $('#id_lon_bottom_right').val())
      var bounds = L.latLngBounds(tl,br);

      var width  = Math.round(bounds.getNorthWest().distanceTo(bounds.getNorthEast()) / 1000)
      var height = Math.round(bounds.getNorthWest().distanceTo(bounds.getSouthWest()) / 1000)
    $('#summary-location').html(
	dd2dms($('#id_lat_upper_left').val(), 'N', 'S') + ', ' +
        dd2dms($('#id_lon_upper_left').val(), 'E', 'W') +
	'&nbsp;&#8600;&nbsp;' +
        dd2dms($('#id_lat_bottom_right').val(), 'N', 'S') + ', ' +
        dd2dms($('#id_lon_bottom_right').val(), 'E', 'W') +
	'&nbsp;&nbsp; ( ca. '+ width + ' x ' + height + ' km² )'
    );
  }

  $('#summary-layout').text($('input[name=layout]:checked').parent().text());
  $('#summary-stylesheet').text($('select[name=stylesheet] option:selected').text());

  var overlay_str = "";
  $( "select[name=overlay] option:selected" ).each(function() {
    overlay_str += $( this ).text() + ", ";
  });

  $('#summary-overlay').text(overlay_str.slice(0,-2));
  $('#summary-paper-size').text(
      ($('input[value=landscape]').is(':checked')
          ? '{% trans "Landscape" %}'
          : '{% trans "Portrait" %}'
      ) + ', ' + $('input[name=papersize]:checked').parent().text().trim());
}
