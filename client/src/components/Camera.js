import { useEffect, useRef, useState } from "react";
import "./Camera.css"

const FullscreenCamera = () => {
  const videoRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);
  const [hasGpsFix, setHasGpsFix] = useState(false);
  const [hasOrientationFix, setHasOrientationFix] = useState(false);
  const [apiData, setApiData] = useState(null);

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

  const FIND_RADIUS = 50;

  async function fetchNearbyBuildings(lat, lon) {
    const response = await fetch("https://macathon.onrender.com/buildings/nearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        radius: FIND_RADIUS,
      }),
    });

    const data = await response.json();
    setApiData(data);
  }

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
        setHasGpsFix(true); // ✅ we now have GPS data at least once

        setCoords({
          latitude: position.coords.latitude,   // ✅ keep as number
          longitude: position.coords.longitude, // ✅ keep as number
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (err) => {
        console.error("Geolocation error:", err);
        setHasGpsFix(false);
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

      // ✅ once we get our first non-null reading, we know the sensor is live
      if (
        event.alpha != null &&
        event.beta != null &&
        event.gamma != null
      ) {
        setHasOrientationFix(true);
      }
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

  const lastOrientationRef = useRef(null);
  const stillSinceRef = useRef(null);

  // 1️⃣ NEW: Create a Ref to hold the current orientation
  // This allows the interval to read the latest value without restarting
  const currentOrientationRef = useRef(orientation);

  // 2️⃣ NEW: Keep the Ref in sync with your state
  useEffect(() => {
    currentOrientationRef.current = orientation;
  }, [orientation]);

  const CHECK_EVERY_MS = 150;
  const STILL_REQUIRED_MS = 2000;
  const ORIENTATION_THRESHOLD = 15;

  const angleDiff360 = (a, b) => {
    const diff = Math.abs(a - b);
    return Math.min(diff, 360 - diff);
  };

  // 3️⃣ UPDATED: The Stillness Logic
  useEffect(() => {
    if (!isStarted) return;
    if (!hasOrientationFix) return;
    if (!hasGpsFix) return;

    const intervalId = setInterval(() => {
      // 4️⃣ IMPORTANT: Read from the REF, not the state variable!
      // This ensures we get fresh data even though 'orientation' isn't in the dependency array
      const current = currentOrientationRef.current;
      const { alpha, beta, gamma } = current;

      if (alpha == null || beta == null || gamma == null) {
        lastOrientationRef.current = null;
        stillSinceRef.current = null;
        setStill(false);
        return;
      }

      const last = lastOrientationRef.current;

      if (last === null) {
        lastOrientationRef.current = current;
        stillSinceRef.current = null;
        setStill(false);
        return;
      }

      const orientationMoved =
        angleDiff360(alpha, last.alpha) > ORIENTATION_THRESHOLD ||
        Math.abs(beta - last.beta) > ORIENTATION_THRESHOLD ||
        Math.abs(gamma - last.gamma) > ORIENTATION_THRESHOLD;

      const now = Date.now();

      if (orientationMoved) {
        stillSinceRef.current = null;
        setStill(false);
      } else {
        if (stillSinceRef.current === null) {
          stillSinceRef.current = now;
          setStill(false);
        } else if (now - stillSinceRef.current >= STILL_REQUIRED_MS) {
          setStill(true);
          fetchNearbyBuildings(coords.latitude, coords.longitude);
        }
      }

      // update baseline
      lastOrientationRef.current = current;
    }, CHECK_EVERY_MS);

    return () => clearInterval(intervalId);

    // 5️⃣ REMOVE 'orientation' from dependencies so the interval stays alive
  }, [isStarted, hasGpsFix, hasOrientationFix]);



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
          <div className={still ? "showing" : "hidden"}>STILL!</div> {/*TESSTTTTTT!!!!!!!!!!!!!!!!!!!!!!! */}

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
                <div className="text">
                  {apiData &&
                    <div className="title"> {apiData.building_name}
                      <ul>
                        {Object.entries(apiData).slice(1).map(([key, value]) => (
                          <li key={key}>
                            <strong>{key}:</strong>{" "}
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : value}
                          </li>
                        ))}
                      </ul>
                    </div>}
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