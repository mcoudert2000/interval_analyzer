/**
 * Utility to fetch and convert Strava Activity Streams to a GPX string.
 * Updated to match official Strava GPX schema and metadata.
 */
export async function fetchStravaGpx(activityUrl, accessToken) {
    if (!activityUrl) throw new Error("No Strava URL provided.");
    if (!accessToken) throw new Error("Not authenticated with Strava.");

    const match = activityUrl.match(/activities\/(\d+)/);
    if (!match) throw new Error("Invalid Strava URL format.");
    const activityId = match[1];

    const headers = { 'Authorization': `Bearer ${accessToken}` };

    try {
        // 1. Get Activity metadata for Name, Type, and Start Time
        const activityRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, { headers });
        if (!activityRes.ok) throw new Error(`Strava API error: ${activityRes.statusText}`);
        const activity = await activityRes.json();

        const startTime = new Date(activity.start_date);
        // Format metadata time: YYYY-MM-DDTHH:mm:ssZ
        const metadataTime = startTime.toISOString().split('.')[0] + "Z";
        const activityType = activity.sport_type?.toLowerCase() || activity.type?.toLowerCase() || "running";

        // 2. Get Streams
        const streamsRes = await fetch(
            `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng,time,altitude,heartrate&key_by_type=true`,
            { headers }
        );
        const streams = await streamsRes.json();

        if (!streams.latlng) throw new Error("No GPS data found.");

        const latlng = streams.latlng.data;
        const times = streams.time.data;
        const altitudes = streams.altitude?.data || new Array(latlng.length).fill(0);
        const heartrate = streams.heartrate?.data || null;

        // 3. Construct Track Points
        let gpxPoints = "";
        for (let i = 0; i < latlng.length; i++) {
            // Strava format: YYYY-MM-DDTHH:mm:ssZ (No milliseconds)
            const pTime = new Date(startTime.getTime() + times[i] * 1000).toISOString().split('.')[0] + "Z";

            let extensions = "";
            if (heartrate && heartrate[i]) {
                extensions = `
    <extensions>
     <gpxtpx:TrackPointExtension>
      <gpxtpx:hr>${Math.round(heartrate[i])}</gpxtpx:hr>
     </gpxtpx:TrackPointExtension>
    </extensions>`;
            }

            gpxPoints += `
   <trkpt lat="${latlng[i][0].toFixed(7)}" lon="${latlng[i][1].toFixed(7)}">
    <ele>${altitudes[i].toFixed(1)}</ele>
    <time>${pTime}</time>${extensions}
   </trkpt>`;
        }

        // 4. Return Full XML matching Strava's schema header
        return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd" creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3">
 <metadata>
  <time>${metadataTime}</time>
 </metadata>
 <trk>
  <name>${activity.name || 'Activity'}</name>
  <type>${activityType}</type>
  <trkseg>${gpxPoints}
  </trkseg>
 </trk>
</gpx>`;
    } catch (err) {
        console.error("fetchStravaGpx Error:", err);
        throw err;
    }
}