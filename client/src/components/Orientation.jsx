import { useEffect, useRef, useState } from "react";

const Orientation = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);

  const [heading, setHeading] = useState(null);
  const [orientationEnabled, setOrientationEnabled] = useState(false);

  // debug
  const [raw, setRaw] = useState({ alpha: null, webkit: null, absolute: null });
  const [geoCourse, setGeoCourse] = useState(null);

  // 📷 Camera
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.error("Camera error:", e);
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // 📍 GPS
  useEffect(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);

        // GPS "heading" only works when moving (speed > ~0)
        if (typeof pos.coords.heading === "number" && !Number.isNaN(pos.coords.heading)) {
          setGeoCourse(Math.round(pos.coords.heading));
        }
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const normalize = (deg) => ((deg % 360) + 360) % 360;

  // 🧭 Sensor handler
  const handleOrientation = (e) => {
    const webkit = typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : null;
    const alpha = typeof e.alpha === "number" ? e.alpha : null;
    const absolute = typeof e.absolute === "boolean" ? e.absolute : null;

    setRaw({ alpha, webkit, absolute });

    let h = null;

    // iOS Safari best source
    if (webkit != null) h = webkit;
    // otherwise fallback to alpha if present
    else if (alpha != null) h = alpha;

    if (h != null) setHeading(Math.round(normalize(h)));
  };

  const stopOrientation = () => {
    window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
    window.removeEventListener("deviceorientation", handleOrientation, true);
  };

  // cleanup on unmount
  useEffect(() => stopOrientation, []);

  // 🔐 Enable orientation (needed for iOS)
  const enableOrientation = async () => {
    try {
      // iOS permission gate
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== "granted") return;
      }

      // prevent stacking listeners
      stopOrientation();

      // try "absolute" first, then normal
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      window.addEventListener("deviceorientation", handleOrientation, true);

      setOrientationEnabled(true);
    } catch (e) {
      console.error("Orientation enable error:", e);
    }
  };

  return (
    <div style={{ position: "relative", height: "100vh", background: "black" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          color: "white",
          fontFamily: "monospace",
          background: "rgba(0,0,0,0.5)",
          padding: 8,
          borderRadius: 6,
          lineHeight: 1.35,
          minWidth: 220,
        }}
      >
        <div>lat: {lat ?? "---"}</div>
        <div>lon: {lon ?? "---"}</div>
        <div>heading (sensor): {heading ?? "---"}°</div>
        <div>heading (gps course): {geoCourse ?? "---"}°</div>

        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
          raw webkit: {raw.webkit ?? "null"}<br />
          raw alpha: {raw.alpha ?? "null"}<br />
          raw absolute: {String(raw.absolute)}
        </div>

        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
          tip: must be HTTPS + allow Motion &amp; Orientation access
        </div>
      </div>

      {!orientationEnabled && (
        <button
          onClick={enableOrientation}
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            padding: "12px 16px",
          }}
        >
          enable orientation
        </button>
      )}
    </div>
  );
};

export default Orientation;
