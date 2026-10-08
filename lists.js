// Predefined "My lists" for the Service Operations Workspace (Lists → My lists → Created by me).
// Conditions use dynamic filters ("Me", "One of my groups"), so they work for every user.
// "^GROUPBY…" sets the list's grouping; it is removed on import when the user turns grouping off.
// "category" = heading the lists are shown under in the Lists sidebar (see content.js, list menu).
// Shared by popup.js (selection) and content.js (creation via the ServiceNow Table API).
var SNCL_LISTS = (() => {
  const SNCL_INC_COLUMNS = 'number,short_description,caller_id,priority,state,business_service,assignment_group,assigned_to,sys_updated_on,sys_updated_by';
  const SNCL_CASE_COLUMNS = 'number,u_affected_user,u_affected_user_email,category,short_description,assignment_group,assigned_to,sys_updated_on,sys_updated_by,priority';
  const SNCL_IDTASK_COLUMNS = 'number,u_affected_user,u_affected_user_email,state,short_description,assignment_group,assigned_to,sys_updated_on,sys_updated_by,priority';
  const SNCL_PROBLEM_COLUMNS = 'number,short_description,state,resolution_code,assignment_group,assigned_to,cmdb_ci,related_incidents';
  const SNCL_CHANGE_COLUMNS = 'number,short_description,type,state,start_date,end_date,requested_by,assigned_to';
  const SNCL_ME = 'assigned_toDYNAMIC90d1921e5f510100a9ad2572f2b477fe';
  const SNCL_MY_GROUPS = 'assignment_groupDYNAMICd6435e965f510100a9ad2572f2b47744';

  return [
    {
      id: 'all-assigned',
      title: 'All tickets - Assigned to me',
      table: 'task', // Incidents, UniBe Cases and ID Tasks together, grouped by type
      condition: `sys_class_nameINincident,sn_customerservice_unibe_case,u_id_task^active=true^${SNCL_ME}^state!=6^GROUPBYsys_class_name`,
      columns: 'number,sys_class_name,short_description,state,priority,assignment_group,assigned_to,sys_updated_on,sys_updated_by',
      order: 10,
      category: 'My work',
    },
    {
      id: 'inc-assigned',
      title: 'Incidents - Assigned to me',
      table: 'incident',
      condition: 'active=true^assigned_to=javascript:getMyAssignments()^incident_stateNOT IN6^GROUPBYassignment_group',
      columns: SNCL_INC_COLUMNS,
      order: 20,
      category: 'My work',
    },
    {
      id: 'inc-unassigned',
      title: 'Incidents - Unassigned',
      table: 'incident',
      condition: `active=true^${SNCL_MY_GROUPS}^assigned_toISEMPTY^incident_stateNOT IN6^GROUPBYassignment_group`,
      columns: SNCL_INC_COLUMNS,
      order: 30,
      category: 'My work',
    },
    {
      id: 'case-assigned',
      title: 'UniBe Case - Assigned to me',
      table: 'sn_customerservice_unibe_case',
      condition: `active=true^${SNCL_ME}^state!=6^GROUPBYassignment_group`,
      columns: SNCL_CASE_COLUMNS,
      order: 40,
      category: 'My work',
    },
    {
      id: 'case-unassigned',
      title: 'UniBe Case - Unassigned',
      table: 'sn_customerservice_unibe_case',
      condition: `active=true^${SNCL_MY_GROUPS}^assigned_toISEMPTY^state!=6^GROUPBYassignment_group`,
      columns: SNCL_CASE_COLUMNS,
      order: 50,
      category: 'My work',
    },
    {
      id: 'idtask-assigned',
      title: 'ID Task - Assigned to me',
      table: 'u_id_task',
      condition: `active=true^state!=6^${SNCL_ME}^GROUPBYassignment_group`,
      columns: SNCL_IDTASK_COLUMNS,
      order: 60,
      category: 'My work',
    },
    {
      id: 'idtask-unassigned',
      title: 'ID Task - Unassigned',
      table: 'u_id_task',
      condition: `active=true^state!=6^${SNCL_MY_GROUPS}^assigned_toISEMPTY^GROUPBYassignment_group`,
      columns: SNCL_IDTASK_COLUMNS,
      order: 70,
      category: 'My work',
    },
    {
      id: 'inc-open-groups',
      title: 'Incidents - Open in my groups',
      table: 'incident',
      condition: `active=true^${SNCL_MY_GROUPS}^incident_stateIN1,2,3^GROUPBYassignment_group`,
      columns: SNCL_INC_COLUMNS,
      order: 80,
      category: 'My groups work',
    },
    {
      id: 'inc-closed-groups',
      title: 'Incidents - Closed in my groups',
      table: 'incident',
      condition: `${SNCL_MY_GROUPS}^incident_stateIN6,7^GROUPBYassignment_group`,
      columns: SNCL_INC_COLUMNS,
      order: 90,
      category: 'My groups work',
    },
    {
      id: 'case-open-groups',
      title: 'UniBe Case - Open in my groups',
      table: 'sn_customerservice_unibe_case',
      condition: `active=true^${SNCL_MY_GROUPS}^stateIN1,10,18,21^GROUPBYassignment_group`,
      columns: SNCL_CASE_COLUMNS,
      order: 100,
      category: 'My groups work',
    },
    {
      id: 'case-closed-groups',
      title: 'UniBe Case - Closed in my groups',
      table: 'sn_customerservice_unibe_case',
      condition: `${SNCL_MY_GROUPS}^stateIN6,3^GROUPBYassignment_group`,
      columns: SNCL_CASE_COLUMNS,
      order: 110,
      category: 'My groups work',
    },
    {
      id: 'idtask-open-groups',
      title: 'ID Task - Open in my groups',
      table: 'u_id_task',
      condition: `active=true^${SNCL_MY_GROUPS}^stateIN1,2,3^GROUPBYassignment_group`,
      columns: SNCL_IDTASK_COLUMNS,
      order: 120,
      category: 'My groups work',
    },
    {
      id: 'idtask-closed-groups',
      title: 'ID Task - Closed in my groups',
      table: 'u_id_task',
      condition: `${SNCL_MY_GROUPS}^stateIN6,7,20^GROUPBYassignment_group`,
      columns: SNCL_IDTASK_COLUMNS,
      order: 130,
      category: 'My groups work',
    },
    {
      id: 'problem-assigned',
      title: 'Problems - Assigned to me',
      table: 'problem',
      condition: 'active=true^assigned_to=javascript:getMyAssignments()^EQ',
      columns: SNCL_PROBLEM_COLUMNS,
      order: 140,
      category: 'Other',
    },
    {
      id: 'problem-unassigned',
      title: 'Problems - Unassigned',
      table: 'problem',
      condition: 'active=true^assigned_toISEMPTY^EQ',
      columns: SNCL_PROBLEM_COLUMNS,
      order: 150,
      category: 'Other',
    },
    {
      id: 'change-assigned',
      title: 'Changes - Assigned to me',
      table: 'change_request',
      condition: 'active=true^EQ',
      columns: SNCL_CHANGE_COLUMNS,
      order: 160,
      category: 'Other',
    },
    {
      id: 'change-unassigned',
      title: 'Changes - Unassigned',
      table: 'change_request',
      condition: 'active=true^EQ',
      columns: SNCL_CHANGE_COLUMNS,
      order: 170,
      category: 'Other',
    },
    {
      id: 'approvals',
      title: 'Approvals - My approvals',
      table: 'sysapproval_approver',
      condition: 'sysapproval.sys_class_name=change_request^ORsysapproval.sys_class_name=std_change_proposal' +
        '^ORsysapproval.sys_class_name=sc_request^ORsysapproval.sys_class_name=sc_req_item^ORsysapproval.sys_class_name=sc_task' +
        '^approver=javascript:getMyAssignments()^ORsys_id=javascript:new global.ApprovalDelegationUtil().getOnlyDelegatedApprovals()^EQ',
      columns: 'state,approver,comments,sysapproval,sys_created_on',
      order: 180,
      category: 'Other',
    },
    {
      id: 'kb-articles',
      title: 'KB Articles',
      table: 'kb_knowledge',
      condition: 'workflow_stateINdraft,review,published,pending_retirement,retired',
      columns: 'number,short_description,author,kb_knowledge_base,kb_category,workflow_state,sys_updated_on,valid_to',
      order: 190,
      category: 'Other',
    },
  ];
})();
