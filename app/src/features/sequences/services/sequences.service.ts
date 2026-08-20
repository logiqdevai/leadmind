import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateSequencePayload,
    CreateSequenceStepPayload,
    ListSequencesQuery,
    OutreachSequence,
    PaginatedSequenceEnrollments,
    SequenceEnrollment,
    SequenceStep,
    UpdateSequencePayload,
    UpdateSequenceStepPayload,
} from "../interfaces/sequence.interface";

export const listSequences = async (query: ListSequencesQuery = {}): Promise<OutreachSequence[]> => {
    try {
        const response = await axiosInstance.get<OutreachSequence[]>(ApiRoutes.sequences.list, {
            params: query,
        });
        return response.data;
    } catch {
        throw new Error("Failed to load sequences. Please try again.");
    }
};

export const getSequence = async (uuid: string): Promise<OutreachSequence> => {
    try {
        const response = await axiosInstance.get<OutreachSequence>(ApiRoutes.sequences.get(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to load sequence. Please try again.");
    }
};

export const createSequence = async (payload: CreateSequencePayload): Promise<OutreachSequence> => {
    try {
        const response = await axiosInstance.post<OutreachSequence>(ApiRoutes.sequences.create, payload);
        return response.data;
    } catch {
        throw new Error("Failed to create sequence. Please try again.");
    }
};

export const updateSequence = async (
    uuid: string,
    payload: UpdateSequencePayload,
): Promise<OutreachSequence> => {
    try {
        const response = await axiosInstance.put<OutreachSequence>(ApiRoutes.sequences.update(uuid), payload);
        return response.data;
    } catch {
        throw new Error("Failed to update sequence. Please try again.");
    }
};

export const deleteSequence = async (uuid: string): Promise<{ uuid: string }> => {
    try {
        const response = await axiosInstance.delete<{ uuid: string }>(ApiRoutes.sequences.remove(uuid));
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to delete sequence. Please try again.");
    }
};

export const activateSequence = async (uuid: string): Promise<OutreachSequence> => {
    try {
        const response = await axiosInstance.post<OutreachSequence>(ApiRoutes.sequences.activate(uuid));
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to activate sequence. Please try again.");
    }
};

export const archiveSequence = async (uuid: string): Promise<OutreachSequence> => {
    try {
        const response = await axiosInstance.post<OutreachSequence>(ApiRoutes.sequences.archive(uuid));
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to archive sequence. Please try again.");
    }
};

export const addSequenceStep = async (
    uuid: string,
    payload: CreateSequenceStepPayload,
): Promise<SequenceStep> => {
    try {
        const response = await axiosInstance.post<SequenceStep>(ApiRoutes.sequences.add_step(uuid), payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to add step. Please try again.");
    }
};

export const updateSequenceStep = async (
    uuid: string,
    stepUuid: string,
    payload: UpdateSequenceStepPayload,
): Promise<SequenceStep> => {
    try {
        const response = await axiosInstance.put<SequenceStep>(
            ApiRoutes.sequences.update_step(uuid, stepUuid),
            payload,
        );
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to update step. Please try again.");
    }
};

export const deleteSequenceStep = async (uuid: string, stepUuid: string): Promise<{ uuid: string }> => {
    try {
        const response = await axiosInstance.delete<{ uuid: string }>(
            ApiRoutes.sequences.remove_step(uuid, stepUuid),
        );
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to delete step. Please try again.");
    }
};

export const reorderSequenceSteps = async (uuid: string, step_uuids: string[]): Promise<SequenceStep[]> => {
    try {
        const response = await axiosInstance.post<SequenceStep[]>(ApiRoutes.sequences.reorder_steps(uuid), {
            step_uuids,
        });
        return response.data;
    } catch {
        throw new Error("Failed to reorder steps. Please try again.");
    }
};

export const enrollContactInSequence = async (
    uuid: string,
    contact_uuid: string,
): Promise<SequenceEnrollment> => {
    try {
        const response = await axiosInstance.post<SequenceEnrollment>(ApiRoutes.sequences.enroll(uuid), {
            contact_uuid,
        });
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to enroll contact. Please try again.");
    }
};

export const bulkEnrollContactsInSequence = async (
    uuid: string,
    contact_uuids: string[],
): Promise<{ enrolled: number; skipped: number; totalMessages: number }> => {
    try {
        const response = await axiosInstance.post<{ enrolled: number; skipped: number; totalMessages: number }>(
            ApiRoutes.sequences.enroll_bulk(uuid),
            { contact_uuids },
        );
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to enroll contacts. Please try again.");
    }
};

export const listSequenceEnrollments = async (
    uuid: string,
    query: { page?: number; limit?: number } = {},
): Promise<PaginatedSequenceEnrollments> => {
    try {
        const response = await axiosInstance.get<PaginatedSequenceEnrollments>(
            ApiRoutes.sequences.enrollments(uuid),
            { params: query },
        );
        return response.data;
    } catch {
        throw new Error("Failed to load enrollments. Please try again.");
    }
};

export const cancelSequenceEnrollment = async (
    uuid: string,
    enrollmentUuid: string,
): Promise<SequenceEnrollment> => {
    try {
        const response = await axiosInstance.post<SequenceEnrollment>(
            ApiRoutes.sequences.cancel_enrollment(uuid, enrollmentUuid),
        );
        return response.data;
    } catch (error: any) {
        throw new Error(error?.response?.data?.message || "Failed to cancel enrollment. Please try again.");
    }
};
