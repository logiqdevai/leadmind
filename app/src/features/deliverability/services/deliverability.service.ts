import axios from "axios";
import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    DeliverabilityRun,
    DeliverabilitySchedule,
    DeliverabilitySchedulePayload,
    UpdateDeliverabilitySchedulePayload,
} from "../interfaces/deliverability.interface";

function apiErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (!data?.message) return fallback;
    return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}

async function request<T>(call: () => Promise<{ data: T }>, fallback: string): Promise<T> {
    try {
        return (await call()).data;
    } catch (error) {
        throw new Error(apiErrorMessage(error, fallback), { cause: error });
    }
}

export const listDeliverabilitySchedules = (): Promise<DeliverabilitySchedule[]> =>
    request(
        () => axiosInstance.get(ApiRoutes.deliverability.schedules),
        "Failed to load deliverability schedules.",
    );

export const createDeliverabilitySchedule = (
    payload: DeliverabilitySchedulePayload,
): Promise<DeliverabilitySchedule> =>
    request(
        () => axiosInstance.post(ApiRoutes.deliverability.schedules, payload),
        "Failed to create schedule.",
    );

export const updateDeliverabilitySchedule = (
    uuid: string,
    payload: UpdateDeliverabilitySchedulePayload,
): Promise<DeliverabilitySchedule> =>
    request(
        () => axiosInstance.patch(ApiRoutes.deliverability.schedule(uuid), payload),
        "Failed to update schedule.",
    );

export const deleteDeliverabilitySchedule = (uuid: string): Promise<{ uuid: string }> =>
    request(
        () => axiosInstance.delete(ApiRoutes.deliverability.schedule(uuid)),
        "Failed to delete schedule.",
    );

export const runDeliverabilityScheduleNow = (uuid: string): Promise<{ queued: true }> =>
    request(
        () => axiosInstance.post(ApiRoutes.deliverability.run_now(uuid), {}),
        "Failed to queue run.",
    );

export const listDeliverabilityRuns = (uuid: string): Promise<DeliverabilityRun[]> =>
    request(
        () => axiosInstance.get(ApiRoutes.deliverability.runs(uuid)),
        "Failed to load run history.",
    );

export const liftDeliverabilityRestriction = (uuid: string): Promise<{ lifted: boolean }> =>
    request(
        () => axiosInstance.delete(ApiRoutes.deliverability.restriction(uuid)),
        "Failed to lift restriction.",
    );

export const applyDeliverabilityRecommendation = (runUuid: string): Promise<DeliverabilityRun> =>
    request(
        () => axiosInstance.post(ApiRoutes.deliverability.apply_recommendation(runUuid), {}),
        "Failed to apply recommendation.",
    );
