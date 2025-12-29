# gpx_utils.py

import xml.etree.ElementTree as ET
from io import StringIO
from typing import Union

import numpy as np
import pandas as pd

# --- Configuration Constants ---
EARTH_RADIUS_KM = 6371.0
MAX_SPEED_KMH_THRESHOLD = 25.0
SMOOTHING_WINDOW = 5
PACE_DIFFERENCE_THRESHOLD = 1
LMA_WINDOW = 15
MIN_INTERVAL_PACE_PER_KM = 5.5
MIN_INTERVAL_TIME_SECONDS = 50
MIN_DISTANCE_FOR_PACE_KM = 0.02


# ---------------------------------------------------------------------
# Formatting Helpers (UNCHANGED)
# ---------------------------------------------------------------------

def format_time(total_time_seconds: float) -> str:
    if pd.isna(total_time_seconds) or total_time_seconds < 0:
        return "N/A"

    total_time_seconds = max(0, int(total_time_seconds))
    hours = total_time_seconds // 3600
    minutes = (total_time_seconds % 3600) // 60
    seconds = total_time_seconds % 60
    return f"{hours:02}:{minutes:02}:{seconds:02}"


def format_pace_min_sec(total_time_seconds: float, total_distance_km: float) -> str:
    if pd.isna(total_distance_km) or total_distance_km <= MIN_DISTANCE_FOR_PACE_KM:
        return "N/A"

    pace_in_minutes = (total_time_seconds / 60.0) / total_distance_km

    if pd.isna(pace_in_minutes) or pace_in_minutes <= 0 or pace_in_minutes > 100:
        return "N/A"

    minutes = int(pace_in_minutes)
    seconds_float = (pace_in_minutes - minutes) * 60
    seconds = int(round(seconds_float))

    if seconds >= 60:
        minutes += 1
        seconds = 0

    return f"{minutes:02d}:{seconds:02d}"


def time_str_to_seconds(time_str: str) -> float:
    if not isinstance(time_str, str) or time_str == "N/A":
        return np.nan
    try:
        h, m, s = map(int, time_str.split(":"))
        return h * 3600 + m * 60 + s
    except Exception:
        return np.nan


# ---------------------------------------------------------------------
# GPX Parsing (UNCHANGED)
# ---------------------------------------------------------------------

def extract_gpx_data(gpx_file: StringIO) -> Union[pd.DataFrame, str]:
    ns = {
        "gpx": "http://www.topografix.com/GPX/1/1",
        "gpxtpx": "http://www.garmin.com/xmlschemas/TrackPointExtension/v1",
    }

    try:
        gpx_file.seek(0)
        tree = ET.parse(gpx_file)
        root = tree.getroot()
    except ET.ParseError as e:
        return f"Error parsing GPX file: {e}"

    row_list = []
    for trkpt in root.findall(".//gpx:trkpt", ns):
        row = {
            "latitude": trkpt.get("lat"),
            "longitude": trkpt.get("lon"),
        }

        ele_element = trkpt.find("gpx:ele", ns)
        time_element = trkpt.find("gpx:time", ns)

        row["elevation"] = ele_element.text if ele_element is not None else None
        row["time"] = time_element.text if time_element is not None else None

        extensions = trkpt.find("gpx:extensions", ns)
        if extensions is not None:
            hr_element = extensions.find(
                "gpxtpx:TrackPointExtension/gpxtpx:hr", ns
            )
            row["heart_rate"] = hr_element.text if hr_element is not None else ""
        else:
            row["heart_rate"] = ""

        row_list.append(row)

    df = pd.DataFrame(row_list)
    df["time"] = pd.to_datetime(df["time"], utc=True, errors="coerce")
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df["heart_rate"] = pd.to_numeric(df["heart_rate"], errors="coerce")

    if not df.empty and df["time"].notna().any():
        start_time = df["time"].iloc[0]
        df["time_since_start_seconds"] = (df["time"] - start_time).dt.total_seconds()
    else:
        df["time_since_start_seconds"] = 0

    return df


# ---------------------------------------------------------------------
# Distance + Pace (UNCHANGED)
# ---------------------------------------------------------------------

def haversine_distance(lat1, lon1, lat2, lon2):
    if isinstance(lat1, pd.Series):
        lat1 = lat1.to_numpy()
        lon1 = lon1.to_numpy()
        lat2 = lat2.to_numpy()
        lon2 = lon2.to_numpy()

    lat1 = np.radians(lat1)
    lon1 = np.radians(lon1)
    lat2 = np.radians(lat2)
    lon2 = np.radians(lon2)

    dlon = lon2 - lon1
    dlat = lat2 - lat1

    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

    return EARTH_RADIUS_KM * c


def calculate_pace_min_per_km(df: pd.DataFrame, window_size: int) -> pd.DataFrame:
    df = df.copy()

    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df["time"] = pd.to_datetime(df["time"], utc=True)

    df["segment_time_seconds"] = df["time"].diff().dt.total_seconds()

    df["distance_km_raw"] = haversine_distance(
        df["latitude"].shift(1),
        df["longitude"].shift(1),
        df["latitude"],
        df["longitude"],
    )

    time_hours = df["segment_time_seconds"] / 3600.0

    instantaneous_speed_kmh = np.where(
        time_hours > 0,
        np.divide(df["distance_km_raw"], time_hours),
        0.0,
    )

    is_outlier = instantaneous_speed_kmh > MAX_SPEED_KMH_THRESHOLD

    df["segment_distance_km"] = np.where(
        is_outlier, 0.0, df["distance_km_raw"]
    )

    df["segment_distance_km"] = np.where(
        df["latitude"].isna()
        | df["longitude"].isna()
        | df["latitude"].shift(1).isna()
        | df["longitude"].shift(1).isna(),
        np.nan,
        df["distance_km_raw"],
    )

    rolling_time_seconds = (
        df["segment_time_seconds"]
        .rolling(window=window_size, min_periods=1)
        .sum()
    )
    rolling_distance_km = (
        df["segment_distance_km"]
        .rolling(window=window_size, min_periods=1)
        .sum()
    )

    time_minutes = rolling_time_seconds / 60.0

    df["pace_min_per_km"] = np.where(
        rolling_distance_km > 0,
        np.divide(time_minutes, rolling_distance_km),
        np.nan,
    )

    df.drop(columns=["distance_km_raw"], inplace=True)
    return df


# ---------------------------------------------------------------------
# Interval Logic (UNCHANGED)
# ---------------------------------------------------------------------

def identify_intervals(df: pd.DataFrame, lma_window: int, pace_difference_threshold: float) -> pd.DataFrame:
    df = df.copy()

    rolling_time_lma = (
            df["segment_time_seconds"]
            .rolling(window=lma_window, min_periods=1)
            .sum()
            / 60.0
    )
    rolling_distance_lma = (
        df["segment_distance_km"]
        .rolling(window=lma_window, min_periods=1)
        .sum()
    )

    df["pace_lma"] = np.where(
        rolling_distance_lma > 0,
        np.divide(rolling_time_lma, rolling_distance_lma),
        np.nan,
    )

    df["pace_deviation"] = df["pace_lma"] - df["pace_min_per_km"]

    df["interval_type"] = "Steady"
    df.loc[
        df["pace_deviation"] < -pace_difference_threshold,
        "interval_type",
    ] = "Slow Interval"

    df["interval_id"] = (
            df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)

    return df


def convert_slow_intervals_to_recovery(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.loc[df["interval_type"] == "Slow Interval", "interval_type"] = "Recovery"
    df["interval_id"] = (
            df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)
    return df


def convert_low_pace_steady_to_recovery(
        df: pd.DataFrame,
        pace_threshold: float
) -> pd.DataFrame:
    df = df.copy()

    summary = (
        df.groupby("interval_id")
        .agg(
            total_distance_km=("segment_distance_km", "sum"),
            total_time_seconds=("segment_time_seconds", "sum"),
            interval_type=("interval_type", "first"),
        )
        .reset_index()
    )

    summary["pace_min_per_km"] = np.where(
        summary["total_distance_km"] > 0,
        (summary["total_time_seconds"] / 60.0) / summary["total_distance_km"],
        np.nan,
    )

    print(f"DEBUG: All Steady intervals:")
    steady_intervals = summary[summary["interval_type"] == "Steady"]
    for _, row in steady_intervals.iterrows():
        print(
            f"  ID {row['interval_id']}: {row['total_distance_km']}m, pace={row['pace_min_per_km']:.2f}, threshold={pace_threshold}")

    low_pace_steady_ids = summary[
        (summary["interval_type"] == "Steady")
        & (
                (summary["pace_min_per_km"] > pace_threshold)
                | (summary["total_distance_km"] < MIN_DISTANCE_FOR_PACE_KM)
        )
        ]["interval_id"].tolist()

    print(f"DEBUG: Converting to Recovery: {low_pace_steady_ids}")

    df.loc[df["interval_id"].isin(low_pace_steady_ids), "interval_type"] = "Recovery"

    df["interval_id"] = (
            df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)
    return df


def merge_short_intervals(
        df: pd.DataFrame,
        min_interval_time_seconds: float
) -> pd.DataFrame:
    df = df.copy()
    max_iterations = 100
    iteration = 0

    while iteration < max_iterations:
        summary = (
            df.groupby("interval_id")
            .agg(
                total_time_seconds=("segment_time_seconds", "sum"),
                interval_type=("interval_type", "first"),
            )
            .reset_index()
        )

        short_intervals = summary[
            summary["total_time_seconds"] < min_interval_time_seconds
            ].copy()

        if len(short_intervals) == 0:
            break

        merged_any = False
        for _, row in short_intervals.iterrows():
            current_id = row["interval_id"]
            all_ids = summary["interval_id"].tolist()
            current_idx = all_ids.index(current_id)

            prev_id = all_ids[current_idx - 1] if current_idx > 0 else None
            next_id = all_ids[current_idx + 1] if current_idx < len(all_ids) - 1 else None

            target_id = None
            if prev_id is not None:
                prev_type = summary[summary["interval_id"] == prev_id]["interval_type"].iloc[0]
                if prev_type == row["interval_type"]:
                    target_id = prev_id

            if target_id is None and next_id is not None:
                next_type = summary[summary["interval_id"] == next_id]["interval_type"].iloc[0]
                if next_type == row["interval_type"]:
                    target_id = next_id

            if target_id is None:
                target_id = prev_id if prev_id is not None else next_id

            if target_id is not None:
                target_type = summary[summary["interval_id"] == target_id]["interval_type"].iloc[0]
                df.loc[df["interval_id"] == current_id, "interval_type"] = target_type
                merged_any = True

        if not merged_any:
            break

        df["interval_id"] = (
                df["interval_type"] != df["interval_type"].shift(1)
        ).cumsum().fillna(1)

        iteration += 1

    return df


def mark_real_intervals(
        df: pd.DataFrame,
        min_interval_time_seconds: float
) -> pd.DataFrame:
    df = df.copy()

    df["interval_id"] = (
            df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)

    summary = (
        df.groupby("interval_id")
        .agg(total_time_seconds=("segment_time_seconds", "sum"))
        .reset_index()
    )

    real_interval_ids = summary[
        summary["total_time_seconds"] >= min_interval_time_seconds
        ]["interval_id"].tolist()

    df["is_real_interval"] = df["interval_id"].isin(real_interval_ids)

    return df


def post_process_intervals(
        df: pd.DataFrame,
        pace_threshold: float,
        min_interval_time_seconds: float,
) -> pd.DataFrame:
    df = convert_slow_intervals_to_recovery(df)
    df = convert_low_pace_steady_to_recovery(df, pace_threshold)
    df = merge_short_intervals(df, min_interval_time_seconds)
    df = mark_real_intervals(df, min_interval_time_seconds)

    return df


def summarize_intervals(df: pd.DataFrame) -> pd.DataFrame:
    summary = []

    for interval_id, segment in df.groupby("interval_id"):
        total_time_seconds = segment["segment_time_seconds"].sum()
        total_distance_km = segment["segment_distance_km"].sum()

        avg_hr = segment["heart_rate"].mean()
        max_hr = segment["heart_rate"].max()

        summary.append(
            {
                "ID": interval_id,
                "Type": segment["interval_type"].iloc[0],
                "Total Distance (m)": round(
                    (total_distance_km * 1000) / 100
                )
                                      * 100,
                "Total Time": format_time(total_time_seconds),
                "Average Pace (min/km)": format_pace_min_sec(
                    total_time_seconds, total_distance_km
                ),
                "Average Heart Rate (BPM)": round(avg_hr) if not pd.isna(avg_hr) else "N/A",
                "Max Heart Rate (BPM)": round(max_hr) if not pd.isna(avg_hr) else "N/A",
                "is_real_interval": segment["is_real_interval"].iloc[0],
            }
        )

    df_summary = pd.DataFrame(summary)
    df_summary["Recovery Time"] = (
        df_summary["Total Time"].shift(-1).fillna("N/A")
    )

    return df_summary


# ---------------------------------------------------------------------
# 🚀 New Entry Point (ORCHESTRATION ONLY)
# ---------------------------------------------------------------------
def read_param(params: dict, key: str, default):
    val = params.get(key)
    if not val:
        val = default
    return val


def run_analysis(gpx_string: str, params: dict):
    smooth_win = read_param(params, "smoothWin", SMOOTHING_WINDOW)
    lma_win = read_param(params, "lmaWin", LMA_WINDOW)
    min_segment_time_sec = read_param(
        params,"minTimeSec", MIN_INTERVAL_TIME_SECONDS)
    min_interval_pace_per_km = read_param(params,
                                          "minIntervalPacePerKm", MIN_INTERVAL_PACE_PER_KM)
    pace_difference_threshold = read_param(params,
                                    "paceDifferenceThreshold", PACE_DIFFERENCE_THRESHOLD)

    print(f"Params: {params}")

    df_extracted = extract_gpx_data(StringIO(gpx_string))
    if isinstance(df_extracted, str):
        raise ValueError(df_extracted)

    df_processed = calculate_pace_min_per_km(
        df_extracted, window_size=smooth_win
    )

    df_processed["pace_lma_min_per_km"] = (
        df_processed["pace_min_per_km"]
        .rolling(window=lma_win, min_periods=1, center=True)
        .mean()
    )

    df_intervals = identify_intervals(df_processed, lma_window=lma_win,
                                      pace_difference_threshold=pace_difference_threshold)

    df_final = post_process_intervals(
        df_intervals,
        pace_threshold=min_interval_pace_per_km,
        min_interval_time_seconds=min_segment_time_sec,
    )

    df_summary = summarize_intervals(df_final)

    return {
        "summaryData": df_summary[df_summary["Type"] == "Steady"].to_json(
            orient="records"
        ),
        "paceData": df_final[
            ["time", "time_since_start_seconds", "pace_min_per_km", "interval_type", "pace_lma_min_per_km"]
        ].to_json(orient="records"),
    }
