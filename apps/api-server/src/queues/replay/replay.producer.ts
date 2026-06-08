import { replayJobName } from "./replay.constants.js";
import { getReplayQueue } from "./replay.client.js";
import {
  selectFailureRefsForReplay,
  selectFailureRefForReplay,
} from "../../modules/replay/replay.service.js";

export const queueReplayFailure = async (
  failureId: string,
  targetBaseUrl?: string,
) => {
  const queue = getReplayQueue();
  const failure = await selectFailureRefForReplay(failureId);

  return queue.add(replayJobName, {
    failureId,
    traceId: failure?.traceId ?? undefined,
    targetBaseUrl,
  });
};

export const queueReplayFailures = async (selection: {
  endpoint?: string;
  failureIds?: string[];
  limit?: number;
  statusCodes?: number[];
  targetBaseUrl?: string;
}) => {
  const queue = getReplayQueue();
  const failureRefs = await selectFailureRefsForReplay(selection);

  if (!failureRefs.length) {
    return [];
  }

  const jobs = failureRefs.map((failure) => ({
    data: {
      failureId: failure.id,
      traceId: failure.traceId ?? undefined,
      targetBaseUrl: selection.targetBaseUrl,
    },
    name: replayJobName,
  }));

  return queue.addBulk(jobs);
};
