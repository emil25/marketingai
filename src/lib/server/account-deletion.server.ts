import type { AppData } from "../data-model";

/** Remove personal references in shared workspaces without deleting others' content. */
export function removeAccountReferences(database: AppData, userId: string) {
  database.postVersions = database.postVersions.filter((version) => version.createdBy !== userId);
  database.channelOAuthStates = database.channelOAuthStates.filter(
    (state) => state.userId !== userId,
  );
  database.channelOAuthSelections = database.channelOAuthSelections.filter(
    (selection) => selection.userId !== userId,
  );
}
