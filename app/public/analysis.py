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
PACE_CHANGE_THRESHOLD = 1.5
LMA_WINDOW = 15
LOW_PACE_THRESHOLD_MIN_PER_KM = 5.5
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

def identify_intervals(df: pd.DataFrame, lma_window: int) -> pd.DataFrame:
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
        df["pace_deviation"] < -PACE_CHANGE_THRESHOLD,
        "interval_type",
    ] = "Slow Interval"

    df["interval_id"] = (
        df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)

    return df


def post_process_intervals(
    df: pd.DataFrame,
    pace_threshold: float,
    min_interval_time_seconds: float,
) -> pd.DataFrame:
    df = df.copy()

    df.loc[df["interval_type"] == "Slow Interval", "interval_type"] = "Recovery"
    df["interval_id"] = (
        df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)

    temp_summary_pace = (
        df.groupby("interval_id")
        .agg(
            total_distance_km=("segment_distance_km", "sum"),
            total_time_seconds=("segment_time_seconds", "sum"),
            interval_type=("interval_type", "first"),
        )
        .reset_index()
    )

    temp_summary_pace["pace_min_per_km"] = np.where(
        temp_summary_pace["total_distance_km"] > 0,
        (temp_summary_pace["total_time_seconds"] / 60.0)
        / temp_summary_pace["total_distance_km"],
        np.nan,
    )

    low_pace_steady_ids = temp_summary_pace[
        (temp_summary_pace["interval_type"] == "Steady")
        & (
            (temp_summary_pace["pace_min_per_km"] >= pace_threshold)
            | (temp_summary_pace["total_distance_km"] < MIN_DISTANCE_FOR_PACE_KM)
        )
    ]["interval_id"].tolist()

    df.loc[
        df["interval_id"].isin(low_pace_steady_ids),
        "interval_type",
    ] = "Recovery"

    df["interval_id"] = (
        df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)

    temp_summary_duration = (
        df.groupby("interval_id")
        .agg(
            total_time_seconds=("segment_time_seconds", "sum"),
            interval_type=("interval_type", "first"),
        )
        .reset_index()
    )

    short_intervals = temp_summary_duration[
        temp_summary_duration["total_time_seconds"]
        < min_interval_time_seconds
    ]

    for _, row in short_intervals.iterrows():
        current_id = row["interval_id"]
        target_id = 2 if current_id == 1 else current_id - 1

        if target_id in temp_summary_duration["interval_id"].values:
            target_type = temp_summary_duration[
                temp_summary_duration["interval_id"] == target_id
            ]["interval_type"].iloc[0]

            df.loc[
                df["interval_id"] == current_id,
                "interval_type",
            ] = target_type

    df["interval_id"] = (
        df["interval_type"] != df["interval_type"].shift(1)
    ).cumsum().fillna(1)

    final_summary = (
        df.groupby("interval_id")
        .agg(total_time_seconds=("segment_time_seconds", "sum"))
        .reset_index()
    )

    real_interval_ids = final_summary[
        final_summary["total_time_seconds"]
        >= min_interval_time_seconds
    ]["interval_id"].tolist()

    df["is_real_interval"] = df["interval_id"].apply(
        lambda x: x in real_interval_ids
    )

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

def run_analysis(gpx_string: str, params: dict):
    smooth_win = params.get("smooth_win", SMOOTHING_WINDOW)
    lma_win = params.get("lma_win", LMA_WINDOW)
    min_segment_time_sec = params.get(
        "min_segment_time_sec", MIN_INTERVAL_TIME_SECONDS
    )

    df_extracted = extract_gpx_data(StringIO(gpx_string))
    if isinstance(df_extracted, str):
        raise ValueError(df_extracted)

    df_processed = calculate_pace_min_per_km(
        df_extracted, window_size=smooth_win
    )

    # IMPORTANT: this line is preserved exactly
    df_processed["pace_lma_min_per_km"] = (
        df_processed["pace_min_per_km"]
        .rolling(window=lma_win, min_periods=1, center=True)
        .mean()
    )

    df_intervals = identify_intervals(df_processed, lma_window=lma_win)

    df_final = post_process_intervals(
        df_intervals,
        pace_threshold=LOW_PACE_THRESHOLD_MIN_PER_KM,
        min_interval_time_seconds=min_segment_time_sec,
    )

    df_summary = summarize_intervals(df_final)

    return {
        "summaryData": df_summary[df_summary["Type"] == "Steady"].to_json(
            orient="records"
        ),
        "paceData": df_final[
            ["time", "pace_min_per_km", "interval_type", "pace_lma_min_per_km"]
        ].to_json(orient="records"),
    }
