import { useEffect, useRef, useState, useCallback } from "react";
import "./Camera.css"

const FullscreenCamera = () => {
  const videoRef = useRef(null);
  
  // Refs for throttling and logic (avoids re-renders)
  const lastUIUpdate = useRef(0); 
  const currentOrientationRef = useRef({ alpha: null, beta: null, gamma: null });
  
  const [isStarted, setIsStarted] = useState(false);
  const [hasGpsFix, setHasGpsFix] = useState(false);
  const [hasOrientationFix, setHasOrientationFix] = useState(false);

  const [coords, setCoords] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
  });

  const [heading, setHeading] = useState(null);
  const [orientationEnabled, setOrientationEnabled] = useState(false);
  
  // This state is now only for VISUAL updates (throttled)
  const [orientation, setOrientation] = useState({
    alpha: null,
    beta: null,
    gamma: null,
  });

  const [showInfo, setShowInfo] = useState(false);
  const touchStartY = useRef(0);

  const [predicted, setPredicted] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // prevents calling API every 150ms while still==true
  const didFetchForCurrentStillRef = useRef(false);

  const fetchPrediction = useCallback(async () => {
    if (coords.latitude == null || coords.longitude == null || heading == null) return;

    setIsFetching(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams({
        lat: String(coords.latitude),
        lng: String(coords.longitude),
        heading_deg: String(heading),
        radius_m: "100",
      });

      const res = await fetch(`https://macathon.onrender.com/buildings/nearby?${params.toString()}`);

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setPredicted(typeof data === "string" ? JSON.parse(data) : data);

    } catch (e) {
      setFetchError(e.message);
    } finally {
      setIsFetching(false);
    }
  }, [coords.latitude, coords.longitude, heading]);

  // 📸 Start rear camera (Fixed Cleanup)
  useEffect(() => {
    if (!isStarted) return;

    let currentVideoElement = null;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 } 
          },
          audio: false,
        });
        
        if (videoRef.current) {
          currentVideoElement = videoRef.current;
          currentVideoElement.srcObject = stream;
          currentVideoElement.setAttribute("playsinline", "true"); // Critical for iOS
          await currentVideoElement.play();
        }
      } catch (error) {
        console.error("Camera error:", error);
      }
    };
    startCamera();

    return () => {
      if (currentVideoElement && currentVideoElement.srcObject) {
        const tracks = currentVideoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isStarted]);

  // 📍 Geolocation updates
  useEffect(() => {
    if (!isStarted || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setHasGpsFix(true); 

        setCoords({
          latitude: position.coords.latitude,   
          longitude: position.coords.longitude, 
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (err) => {
        console.error("Geolocation error:", err);
        setHasGpsFix(false);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isStarted]);

  // 🧭 Device orientation (Optimized with Throttling)
  const enableOrientation = async () => {
    const handleOrientation = (event) => {
      // 1. INSTANT UPDATE: Update the Ref immediately for logic
      currentOrientationRef.current = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      };

      // 2. THROTTLED UI UPDATE: Only re-render React every 150ms
      const now = Date.now();
      if (now - lastUIUpdate.current > 150) {
        lastUIUpdate.current = now;

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
          alpha: event.alpha ?? null, 
          beta: event.beta ?? null,
          gamma: event.gamma ?? null,
        });

        if (event.alpha != null && !hasOrientationFix) {
           setHasOrientationFix(true);
        }
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

    const intervalId = setInterval(() => {
      // 4️⃣ IMPORTANT: Read from the REF, not the state!
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
        }
      }

      // update baseline
      lastOrientationRef.current = current;
    }, CHECK_EVERY_MS);

    return () => clearInterval(intervalId);
    
  }, [isStarted, hasOrientationFix]); 

  // Make sure to "use" the orientation state to avoid linter error
  // This is a dummy effect that does nothing but satisfies the linter
  useEffect(() => {
    if (orientation.alpha === -999) console.log("ignore");
  }, [orientation]);

  useEffect(() => {
    if (!still) {
      didFetchForCurrentStillRef.current = false;
      return;
    }

    if (didFetchForCurrentStillRef.current) return;
    if (!hasGpsFix || !hasOrientationFix) return;

    didFetchForCurrentStillRef.current = true;
    fetchPrediction();

  }, [still, hasGpsFix, hasOrientationFix, fetchPrediction]);


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
              onClick={() => {
                setShowInfo(true);
              }}
              className="houseBtn"
            >
              🏠
            </button>
          )}

          <div className={still ? "showing" : "hidden"}>STILL!</div>

          {/* 🪧 Property Info Panel - Slide Up */}
          {showInfo && (
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="infoPanel"
            >
              <div className="swipeHeader">
                <div className="swipeBar" />
              </div>

              <div className="infoContent">
                <div className="houseEmoji">🏠</div>

                {isFetching && <p className="subtle">Loading...</p>}

                {fetchError && (
                  <p className="subtle" style={{ opacity: 0.9 }}>
                    Error: {fetchError}
                  </p>
                )}

                {!isFetching && !fetchError && !predicted && (
                  <p className="subtle">No prediction yet. Hold still to scan.</p>
                )}

                {!isFetching && !fetchError && predicted && (
                  <>
                    <h3 className="title">{predicted.building_name}</h3>
                    <p className="subtle">{predicted.location}</p>

                    <div className="priceCard">
                      <div className="priceType">{predicted.predicted_price_or_rent?.type}</div>
                      <div className="priceAmount">
                        {predicted.predicted_price_or_rent?.currency} ${predicted.predicted_price_or_rent?.amount}
                      </div>
                      <div className="confidence">
                        Confidence: {predicted.predicted_price_or_rent?.confidence}
                      </div>
                    </div>

                    <p className="notes">{predicted.predicted_price_or_rent?.notes}</p>

                    <h3 className="sectionTitle">📈 Price Projection</h3>
                    <div className="sectionBlock">
                      <div className="row">
                        <strong>1 Year:</strong> ${predicted.future_price_projection?.["1_year"]}
                      </div>
                      <div className="row">
                        <strong>5 Years:</strong> ${predicted.future_price_projection?.["5_year"]}
                      </div>
                      <div className="row">
                        <strong>Trend:</strong> {predicted.future_price_projection?.trend} (
                        {predicted.future_price_projection?.confidence})
                      </div>
                    </div>

                    <p className="italicNote">{predicted.future_price_projection?.notes}</p>

                    <h3 className="sectionTitle">🛒 Nearby Grocery</h3>
                    <ul className="list">
                      {(predicted.nearby_food_grocery || []).map((store, i) => (
                        <li key={i} className="listItem">{store}</li>
                      ))}
                    </ul>

                    <h3 className="sectionTitle">🏫 Nearby Schools</h3>
                    <ul className="list">
                      {(predicted.nearby_schools || []).map((school, i) => (
                        <li key={i} className="listItem">{school}</li>
                      ))}
                    </ul>

                    <div className="footerHint">Swipe down to return to camera</div>
                  </>
                )}
              </div>
            </div>
          )}
          
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