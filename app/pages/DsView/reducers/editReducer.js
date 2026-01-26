/**
 * Edit reducer for tracking cell edit states
 * Replicates the dsEdits portion of the Redux dsHome reducer
 */

export const initialEditState = {};

export const EDIT_ACTION_TYPES = {
  EDIT_START: 'EDIT_START',
  EDIT_SUCCESS: 'EDIT_SUCCESS',
  EDIT_FAILURE: 'EDIT_FAILURE',
  EDIT_DELETE_TRACKER: 'EDIT_DELETE_TRACKER',
};

/**
 * Edit reducer function
 * @param {Object} state - Current edit state: { [_id]: { editStatus, serverStatus, editTracker, error } }
 * @param {Object} action - Action object with type and payload
 * @returns {Object} New state
 */
export function editReducer(state, action) {
  switch (action.type) {
    case EDIT_ACTION_TYPES.EDIT_START:
      return {
        ...state,
        [action._id]: {
          editStatus: 'editing',
          editTracker: action.editTracker,
        },
      };

    case EDIT_ACTION_TYPES.EDIT_SUCCESS:
      return {
        ...state,
        [action._id]: {
          editStatus: 'done',
          serverStatus: action.serverStatus,
          editTracker: action.editTracker,
        },
      };

    case EDIT_ACTION_TYPES.EDIT_FAILURE:
      return {
        ...state,
        [action._id]: {
          editStatus: 'fail',
          editTracker: action.editTracker,
          error: action.error,
        },
      };

    case EDIT_ACTION_TYPES.EDIT_DELETE_TRACKER:
      {
        const newState = { ...state };
        delete newState[action._id];
        return newState;
      }

    default:
      return state;
  }
}

export default editReducer;
