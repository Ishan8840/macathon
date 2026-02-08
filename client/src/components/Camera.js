import { useEffect, useRef, useState } from "react";
import "./Camera.css"

const FullscreenCamera = () => {
  const videoRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);

  const [coords, setCoords] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
  });

  const [heading, setHeading] = useState(null);
  const [orientationEnabled, setOrientationEnabled] = useState(false);
  const [orientation, setOrientation] = useState({
    alpha: null,
    beta: null,
    gamma: null,
  });

  const [showInfo, setShowInfo] = useState(false);
  const touchStartY = useRef(0);

  const predicted = {
    building_name: "14 Arnall Avenue",
    location: "Toronto, Canada",
    predicted_price_or_rent: {
      type: "rent",
      amount: "3500",
      currency: "CAD",
      confidence: "medium",
      notes:
        "Estimated monthly rent for a typical residential unit in the Scarborough area, reflecting current market conditions for similar properties.",
    },
    future_price_projection: {
      "1_year": "3605",
      "5_year": "4025",
      trend: "up",
      confidence: "medium",
      notes:
        "Projections based on historical performance of Toronto's residential market and anticipated economic stability, with moderate growth expected.",
    },
    nearby_food_grocery: [
      "FreshCo (Sheppard & Markham)",
      "Walmart Supercentre (Sheppard Ave E)",
      "T&T Supermarket (Middlefield Rd)",
    ],
    nearby_schools: [
      "Mary Ward Catholic Secondary School",
      "Silver Springs Public School",
      "Agincourt Junior Public School",
    ],
  };

  // 📸 Start rear camera
  useEffect(() => {
    if (!isStarted) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        console.error("Camera error:", error);
      }
    };
    startCamera();
  }, [isStarted]);

  // 📍 Geolocation updates
  useEffect(() => {
    if (!isStarted || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,   // ✅ keep as number
          longitude: position.coords.longitude, // ✅ keep as number
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (err) => console.error("Geolocation error:", err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isStarted]);

  // 🧭 Device orientation
  const enableOrientation = async () => {
    const handleOrientation = (event) => {
      let compassHeading = null;

      if (typeof event.webkitCompassHeading === "number") {
        compassHeading = event.webkitCompassHeading;
      } else if (typeof event.alpha === "number") {
        compassHeading = event.alpha;
      }

      if (compassHeading !== null) {
        compassHeading = compassHeading % 360;
        if (compassHeading < 0) compassHeading += 360;
        setHeading(Math.round(compassHeading));
      }

      setOrientation({
        alpha: event.alpha ?? null, // ✅ keep as number
        beta: event.beta ?? null,
        gamma: event.gamma ?? null,
      });
    };

    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === "granted") {
          window.addEventListener("deviceorientation", handleOrientation, true);
          setOrientationEnabled(true);
        }
      } else {
        window.addEventListener("deviceorientation", handleOrientation, true);
        setOrientationEnabled(true);
      }
    } catch (error) {
      console.error("Orientation error:", error);
    }
  };

  // 🏠 Show icon if heading is ~north (±10°)
  // const isFacingNorth = heading !== null && (heading <= 10 || heading >= 350);

  // Handle swipe down to close popup
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const swipeDistance = touchEndY - touchStartY.current;

    // If swiped down more than 100px, close popup
    if (swipeDistance > 100) {
      setShowInfo(false);
    }
  };

  //********************************************************************** */
  const [still, setStill] = useState(false);

  const CHECK_EVERY_MS = 150;

  // thresholds for "no movement"
  const GPS_THRESHOLD = 0.00002; // ~2 meters in lat/lng
  const ORIENTATION_THRESHOLD = 15; // degrees

  // store previous values
  const lastValuesRef = useRef({
    latitude: null,
    longitude: null,
    alpha: null,
    beta: null,
    gamma: null,
  });

  useEffect(() => {
    if (!isStarted) return;

    const intervalId = setInterval(() => {
      const { latitude, longitude } = coords;
      const { alpha, beta, gamma } = orientation;

      // wait until all values exist
      if (
        latitude === null ||
        longitude === null ||
        alpha === null ||
        beta === null ||
        gamma === null
      ) {
        setStill(false); 
        return;
      }

      const last = lastValuesRef.current;

      // first run setup
      if (last.latitude === null) {
        lastValuesRef.current = { latitude, longitude, alpha, beta, gamma };
        return;
      }

      const gpsMoved =
        Math.abs(latitude - last.latitude) > GPS_THRESHOLD ||
        Math.abs(longitude - last.longitude) > GPS_THRESHOLD;

      const orientationMoved =
        Math.abs(alpha - last.alpha) > ORIENTATION_THRESHOLD ||
        Math.abs(beta - last.beta) > ORIENTATION_THRESHOLD ||
        Math.abs(gamma - last.gamma) > ORIENTATION_THRESHOLD;

      if (gpsMoved || orientationMoved) {
        console.log("📍 Device moved");
        setStill(false);
      } else {
        console.log("🧊 Device still");
        setStill(true);
      }

      // update last values
      lastValuesRef.current = { latitude, longitude, alpha, beta, gamma };
    }, CHECK_EVERY_MS);

    return () => clearInterval(intervalId);
  }, [isStarted, coords, orientation]);



  return (
  <div className="arRoot">
    {/* Start AR Button */}
    {!isStarted && (
      <button onClick={() => setIsStarted(true)} className="startARBtn">
        Start AR
      </button>
    )}

    {/* All camera and UI elements - only show after start */}
    {isStarted && (
      <>
        {/* 📷 Fullscreen Camera */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="cameraVideo"
        />

        {/* 🔴 Red Dot Center */}
        <div className="centerDot" />

        {/* 🏠 House Icon - Bottom Right */}
        {still && (
          <button
            onClick={() => setShowInfo(true)}
            className="houseBtn"
          >
            🏠
          </button>
        )}
        {/* <div className={still ? "showing" : "hidden"}>STILL!</div> TESSTTTTTT!!!!!!!!!!!!!!!!!!!!!!! */}

        {/* 🪧 Property Info Panel - Slide Up */}
        {showInfo && (
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="infoPanel"
          >
            {/* Swipe indicator */}
            <div className="swipeHeader">
              <div className="swipeBar" />
            </div>

            <div className="infoContent">
              <div className="houseEmoji">🏠</div>

              <h3 className="title">{predicted.building_name}</h3>
              <p className="subtle">{predicted.location}</p>

              <div className="priceCard">
                <div className="priceType">{predicted.predicted_price_or_rent.type}</div>
                <div className="priceAmount">
                  {predicted.predicted_price_or_rent.currency} ${predicted.predicted_price_or_rent.amount}
                </div>
                <div className="confidence">
                  Confidence: {predicted.predicted_price_or_rent.confidence}
                </div>
              </div>

              <p className="notes">{predicted.predicted_price_or_rent.notes}</p>

              <h3 className="sectionTitle">📈 Price Projection</h3>
              <div className="sectionBlock">
                <div className="row"><strong>1 Year:</strong> ${predicted.future_price_projection["1_year"]}</div>
                <div className="row"><strong>5 Years:</strong> ${predicted.future_price_projection["5_year"]}</div>
                <div className="row">
                  <strong>Trend:</strong> {predicted.future_price_projection.trend} (
                  {predicted.future_price_projection.confidence})
                </div>
              </div>

              <p className="italicNote">{predicted.future_price_projection.notes}</p>

              <h3 className="sectionTitle">🛒 Nearby Grocery</h3>
              <ul className="list">
                {predicted.nearby_food_grocery.map((store, i) => (
                  <li key={i} className="listItem">{store}</li>
                ))}
              </ul>

              <h3 className="sectionTitle">🏫 Nearby Schools</h3>
              <ul className="list">
                {predicted.nearby_schools.map((school, i) => (
                  <li key={i} className="listItem">{school}</li>
                ))}
              </ul>

              <div className="footerHint">
                Swipe down to return to camera
              </div>
            </div>
          </div>
        )}

        {/* ℹ️ Info HUD */}
        <div className="hud">
          <div>📍 Lat: {coords.latitude ?? "---"}</div>
          <div>📍 Lng: {coords.longitude ?? "---"}</div>
          <div>🧭 Heading: {heading !== null ? `${heading}°` : "---"}</div>
          <div>📐 Alpha: {orientation.alpha ?? "---"}°</div>
          <div>📐 Beta: {orientation.beta ?? "---"}°</div>
          <div>📐 Gamma: {orientation.gamma ?? "---"}°</div>
        </div>

        {/* 🛡 Motion Permission */}
        {!orientationEnabled && (
          <button onClick={enableOrientation} className="enableOrientationBtn">
            Enable Orientation
          </button>
        )}
      </>
    )}
  </div>
);
};

export default FullscreenCamera;