                        // ************* BOOTSTRAP / ENTRY POINT ************* //

$(init); // Start app once DOM is ready

// App state
let spotsData = [];
let userLocation = null;
let map = null;
let infoWindow = null;
let markers = [];

                              // ************* CONTROLLER ************* //

// Controls startup flow
function init() {
  // Load spots immediatley despite location, which is optional from user
  loadTopSpots();

  // Try to get user location (optional)
  getUserLocation()
    .then((loc) => {
      userLocation = loc;

      // If we already have spots, update distances, sort, render, and recenter map
      if (spotsData.length) {
        computeDistances(spotsData);
        sortByDistance(spotsData);
        renderSpots(spotsData);
        updateMap(spotsData);
      }
    })
    .catch((err) => {
      console.log("Location unavailable:", err?.message || err);
      // App still works, but distances will show "—"
    });
}

                            // ************* DATA LOADING *************//

// Distance logic and sorting
function loadTopSpots() {
  $.getJSON("data.json")
    .done(function (spots) {
      spotsData = Array.isArray(spots) ? spots : (spots.topSpots || spots.spots || []);

      // If we already have userLocation, compute distances and sort
      computeDistances(spotsData);
      sortByDistance(spotsData);

      // Render table
      renderSpots(spotsData);

      // Add pins
      updateMap(spotsData);
    })
    .fail(function () {
      console.log("Error loading data.json");
    });
}

                            // *************** DOMAIN LOGIC *************** //

// Get straighline distances to spots
function computeDistances(spots) {
  spots.forEach((spot) => {
    const lat = spot.location?.[0];
    const lng = spot.location?.[1];

    if (!userLocation || lat == null || lng == null) {
      spot.distanceMiles = null;
      return;
    }
    spot.distanceMiles = haversineMiles(userLocation.lat, userLocation.lng, lat, lng);
  });
}

// Sort distances
function sortByDistance(spots) {
  spots.sort((a, b) => {
    if (a.distanceMiles == null) return 1;
    if (b.distanceMiles == null) return -1;
    return a.distanceMiles - b.distanceMiles;
  });
}

                              // ************** VIEW / UI *************** //

// Take array of spot objects and displays them in <tbody>
function renderSpots(spots) {
  const $tbody = $("#top-spots-body");
  $tbody.empty();

  spots.forEach((spot) => {
    $tbody.append(buildRow(spot));
  });
}

// Builds a row for each spot
function buildRow(spot) {
  const name = spot.name || "";
  const description = spot.description || "";
  const placeID = spot.placeID || "";

  const lat = spot.location?.[0];
  const lng = spot.location?.[1];

  const mapsUrl = buildMapsUrl(name, lat, lng, placeID);

    // Directions URL using user's location if available
  const dirUrl =
    userLocation && lat != null && lng != null
      ? buildDirectionsUrl(userLocation.lat, userLocation.lng, lat, lng)
      : mapsUrl;

  const distanceText = 
    spot.distanceMiles == null ? "—" : `${spot.distanceMiles.toFixed(1)} mi`;

  const $row = $("<tr></tr>");
  $row.append($("<td></td>").text(name));
  $row.append($("<td></td>").text(description));

  const $dirLink = $("<a></a>")
    .attr("href", dirUrl)
    .attr("target", "_blank") // Open link in new tab
    .attr("rel", "noopener noreferrer") // Security and privacy
    .addClass("directions-link")
    .text("Directions");

  const $mapsLink = $("<a></a>")
    .attr("href", mapsUrl)
    .attr("target", "_blank") // Open link in new tab
    .attr("rel", "noopener noreferrer") // Security and privacy 
    .addClass("maps-link")
    .text("Open in Google Maps");

  $row.append($("<td></td>").append($mapsLink).append(" | ").append($dirLink));
  $row.append($("<td></td>").text(distanceText));

  return $row;
}

                        // ************* GOOGLE MAPS API CALLBACK ************* //

// initMap() is called automatically by Google script
function initMap() {
  const defaultCenter = { lat: 32.7157, lng: -117.1611 }; // San Diego coordinates

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 10,
    center: defaultCenter,
  });

  infoWindow = new google.maps.InfoWindow();

  // If spots loaded, make pins
  if (spotsData.length) {
    updateMap(spotsData);
  }
}

// Add pins + hover tooltips
function updateMap(spots) {
  if (!map) return;
  
  // Prevent duplicates
  markers.forEach((m) => m.setMap(null));
  markers = [];

  // Commented out in case user is not in San Diego
  // Otherwise, this would center the map on the userLocation coordinates

  //    if (userLocation) {
  //      map.setCenter(userLocation);
  //    }

  spots.forEach((spot) => {
    const lat = spot.location?.[0];
    const lng = spot.location?.[1];
    if (lat == null || lng == null) return;

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: spot.name,
    });

    // When mouse is over the marker, display spot description
    marker.addListener("mouseover", () => {
      infoWindow.setContent(
        `<strong>${spot.name || ""}</strong><br>${spot.description || ""}`
      );
      infoWindow.open(map, marker);
    });

    marker.addListener("mouseout", () => infoWindow.close());
  });
}

                              // **************** UTILITY **************** //

// Prefer Place ID so Google Maps opens the real place instead of coordinates
// Fallback to coordinates if no placeID.
function buildMapsUrl(name, lat, lng, placeID) {
  if (placeID) {
    const query = name ? encodeURIComponent(name) : (lat != null && lng != null ? `${lat},${lng}` : "");
    // This format opens a place result tied to the place_id
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(placeID)}`;
  }
  
  if (lat == null || lng == null) return "#";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Use Google Maps API to build directions link
function buildDirectionsUrl(fromLat, fromLng, toLat, toLng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}`;
}

// Haversine math for direct distance
function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.8; // miles

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

                            // *************** GEOLOCATION *************** //

// Get user geolocation using the navigator object
const getUserLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });



