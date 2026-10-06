// Predefined "My lists" for the Service Operations Workspace (Lists → My lists → Created by me).
// Conditions use dynamic filters ("Me", "One of my groups"), so they work for every user.
// Shared by popup.js (selection) and content.js (creation via the ServiceNow Table API).
var SNCL_LISTS = [
  {
    id: 'inc-assigned',
    title: 'Incidents - Assigned',
    table: 'incident',
    condition: 'active=true^assigned_to=javascript:getMyAssignments()^incident_stateNOT IN6',
    columns: 'number,short_description,caller_id,priority,state,business_service,assignment_group,assigned_to,sys_updated_on,sys_updated_by',
    order: 10,
  },
  {
    id: 'inc-group',
    title: 'Incidents - Group',
    table: 'incident',
    condition: 'active=true^assignment_groupDYNAMICd6435e965f510100a9ad2572f2b47744^assigned_toISEMPTY^incident_stateNOT IN6',
    columns: 'number,short_description,caller_id,priority,state,business_service,assignment_group,assigned_to,sys_updated_on,sys_updated_by',
    order: 20,
  },
  {
    id: 'case-assigned',
    title: 'UniBe Case - Assigned',
    table: 'sn_customerservice_unibe_case',
    condition: 'active=true^assigned_toDYNAMIC90d1921e5f510100a9ad2572f2b477fe^state!=6',
    columns: 'number,u_affected_user,u_affected_user_email,category,short_description,assignment_group,assigned_to,sys_updated_on,sys_updated_by,priority',
    order: 30,
  },
  {
    id: 'case-group',
    title: 'UniBe Case - Group',
    table: 'sn_customerservice_unibe_case',
    condition: 'active=true^assignment_groupDYNAMICd6435e965f510100a9ad2572f2b47744^assigned_toISEMPTY^state!=6',
    columns: 'number,u_affected_user,u_affected_user_email,category,short_description,assignment_group,assigned_to,sys_updated_on,sys_updated_by,priority',
    order: 40,
  },
  {
    id: 'idtask-assigned',
    title: 'ID Task - Assigned',
    table: 'u_id_task',
    condition: 'active=true^state!=6^assigned_toDYNAMIC90d1921e5f510100a9ad2572f2b477fe',
    columns: 'number,u_affected_user,u_affected_user_email,state,short_description,assignment_group,assigned_to,sys_updated_on,sys_updated_by,priority',
    order: 50,
  },
  {
    id: 'idtask-group',
    title: 'ID Task - Group',
    table: 'u_id_task',
    condition: 'active=true^state!=6^assignment_groupDYNAMICd6435e965f510100a9ad2572f2b47744^assigned_toISEMPTY',
    columns: 'number,u_affected_user,u_affected_user_email,state,short_description,assignment_group,assigned_to,sys_updated_on,sys_updated_by,priority',
    order: 60,
  },
];
