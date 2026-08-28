import { Request, Response } from 'express';
import * as groupsService from './groups.service';
import { sendSuccess, sendError } from '../../utils/response';
import { InscriptionType } from '@prisma/client';

export const createGroup = async (req: Request, res: Response) => {
    try {
        const group = await groupsService.createGroup(req.body);
        sendSuccess(res, group, 'Group created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create group', 400);
    }
};

export const getAllGroups = async (req: Request, res: Response) => {
    try {
        const { type } = req.query;
        const groups = await groupsService.getAllGroups(type as InscriptionType);
        sendSuccess(res, groups, 'Groups retrieved successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve groups');
    }
};

export const getGroupById = async (req: Request, res: Response) => {
    try {
        const group = await groupsService.getGroupById(req.params.id);
        sendSuccess(res, group, 'Group details retrieved successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Group not found', 404);
    }
};

export const updateGroup = async (req: Request, res: Response) => {
    try {
        const group = await groupsService.updateGroup(req.params.id, req.body);
        sendSuccess(res, group, 'Group updated successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update group', 400);
    }
};

export const deleteGroup = async (req: Request, res: Response) => {
    try {
        await groupsService.deleteGroup(req.params.id);
        sendSuccess(res, null, 'Group deleted successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete group', 400);
    }
};
