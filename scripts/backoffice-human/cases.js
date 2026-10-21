// Small, ordered human protocol. No case is answered by the developer harness.
const item=(id,group,title,steps,expected,target='workspace',criterion='BO-HTTP-12')=>({id,group,title,steps,expected,target,criterion});
export const cases=[
 item('ENV-01','Readiness','Firefox and your keyboard',[
  'Use the separate Firefox test window. Leave Orca off for the keyboard section. Keep this guide tab open.',
  'Use Tab to reach Open focus check below and press Enter. It opens a second tab. Use Ctrl+PageUp to return here; Ctrl+PageDown returns to the test tab.',
  'In the focus check, press Ctrl+L, then Escape, then Tab without clicking the document. Type sample into the Sample field, then use Shift+Tab and Tab.'],
  'The document accepts real keyboard input, focus is visible, and Tab moves between controls. If it does not, record Couldn’t Test and follow Focus troubleshooting below. A manual success does not resolve B6 automation.','focus'),
 item('KEY-01','Keyboard','Sign in and open an approved Page',[
  'Open Sign in below. Use only Tab, Shift+Tab, Enter and typing from now on. Use Ctrl+L then Escape then Tab to enter the document.',
  'Enter the sample username and password shown in this guide. Tab to the sign-in button and press Enter. Wait for Submission complete.',
  'Use Ctrl+L to enter the exact Workspace URL shown below, then Enter. Try the skip link and Tab through the Page.'],
  'Sign-in completes. The approved Workspace Page opens, the skip link reaches main content, and focus is visible in a sensible order.','login'),
 item('KEY-02','Keyboard','Move forward and backward',[
  'On Workspace, use Tab through the Editor and Dashboard links and the Load current state button. Use Shift+Tab to move back.',
  'Activate Editor and Dashboard links with Enter. Return to Editor. Do not click or run focus scripts.'],
  'Every available control can be reached and left; focus is visible and no keyboard trap occurs.'),
 item('KEY-03','Keyboard','Load and edit an ordinary property',[
  'Activate Load current state with Enter. Wait for Action completed. Tab into the enabled Workspace properties and content form.',
  'In title, select the old value with Ctrl+A and type Human workspace. Leave version unchanged.',
  'Tab to Confirm Workspace properties and content and press Space. Tab to Save changes and press Enter.'],
  'Editing starts only after loading. Space checks confirmation, Enter saves, Result receives focus and Action completed appears. Each save needs fresh confirmation.'),
 item('KEY-04','Keyboard','Change the layout',[
  'In the same form, use Space on columns to select true. Keep title Human workspace.',
  'Confirm with Space and Save changes with Enter. Reload with Ctrl+R and load current state again.'],
  'The columns value persists after reload, the preview uses columns, and focus remains usable after each update.'),
 item('KEY-05','Keyboard','Edit Markdown and confirm persistence',[
  'Change body to: ## Human note followed by a new line and Saved **sample** content.',
  'Confirm and save. Reload the Page, inspect the Markdown preview, and load current state again.'],
  'The preview has a Human note heading and emphasized sample text. title, columns and body retain saved values.'),
 item('KEY-06','Keyboard','Read and recover from validation errors',[
  'After loading, select version and replace it with 0. Try Save changes.',
  'Read the error, find the invalid field and check whether your other values remain. Restore version by activating Load current state.',
  'Try saving without checking confirmation. Then check confirmation and save valid values.'],
  'Invalid input and missing confirmation are explained, focus helps recovery, valid input persists, and success differs from failure.'),
 item('KEY-07','Keyboard','Use the dashboard and return',[
  'Use the Dashboard link. Activate Refresh dashboard. Read the result and Tab through any disclosures or scrollable regions.',
  'Return here with Ctrl+PageUp. Open the BackOffice shell link in Sample links and sign-in. Use Alt+Left in the test tab to return to Workspace. Reload Workspace, then return here.'],
  'Dashboard shows the home record, title, columns and body. Tables/disclosures work by keyboard; return, reload and result updates keep focus usable.'),
 item('KEY-08','Keyboard','Handle a real permission denial',[
  'In Workspace, load the current state while write access is still allowed. Return to this guide.',
  'Activate Deny sample writes below. Return to the already loaded Workspace tab. Change title to Denied sample, confirm and save.',
  'Observe the failure and recovery focus. Return here, Restore sample writes, then reload Workspace and load again.'],
  'The stale write is denied, an access message and Reload Page recovery are available, and Denied sample did not replace the saved title.'),
 item('KEY-09','Keyboard','Check a Page permission denial',[
  'Activate Deny sample Page below. Return to Workspace and reload.',
  'Return to the guide with Ctrl+PageUp, Restore sample writes (also restores Page access), and reopen Workspace.'],
  'The Page is denied independently of action permissions. The guide still records results and access returns only after restoring permission.'),
 item('KEY-10','Keyboard','Dialogs and focus restoration',[
  'The installed Workspace uses inline confirmation and has no product dialog. Observe whether any product dialog actually appears.',
  'If one appears, describe how to open it; use Tab and Shift+Tab, close with its documented control or Escape, and check where focus returns.'],
  'For this fixture choose Couldn’t Test with note: No product dialog in scope. If a product dialog exists, test its name, focus containment, close control and focus restoration.'),
 item('KEY-11','Keyboard','Use other installed modules and reusable controls',[
  'Open Notices sign-in, use Tab to sign in as alice, then return to the guide and open Notices from Sample links and sign-in.',
  'Use only the keyboard. Include sort, Add item, set field to title and direction to asc. Add a second item, then Remove item and observe focus. Refresh the dashboard.',
  'Include offset, enter 100, and refresh to produce an empty result. Then exclude offset and refresh again. Open Members, activate its read control, and use Alt+Left to return to Notices.'],
  'Both real module Pages work by keyboard. Include, Add, Remove, result tables and empty results are understandable, focus recovers, and navigation back works.','modules'),
 item('AT-00','Screen reader readiness','Confirm Orca speech before testing',[
  'In a spare terminal run orca and keep that terminal open; Ctrl+C there exits Orca. If missing, install only after you approve running sudo apt install orca. No package is installed by this launcher.',
  'Return to Firefox with Alt+Tab and use Tab on this guide. Confirm that you actually hear control names. If you hear nothing, check volume/output and Cinnamon Accessibility settings.',
  'Orca modifier is Insert in Desktop layout or CapsLock in Laptop layout. Modifier+H enters Learn Mode; Escape leaves it. Confirm your layout with the help below.'],
  'You hear meaningful speech. Executable presence alone does not pass. If speech fails, record Couldn’t Test and an environmental blocker; leave later AT tests incomplete.','guide'),
 item('AT-01','Screen reader','Read headings, landmarks and names',[
  'With Orca speaking, open Workspace. In browse mode use H and Shift+H for headings, M and Shift+M for landmarks, and F for form controls.',
  'Use Orca modifier+A to toggle browse/focus mode if needed. Tab to controls and listen to names and disabled state.'],
  'You understand Page structure, Editor, Dashboard, main content and each control’s purpose without visual guessing.'),
 item('AT-02','Screen reader','Understand fields and required values',[
  'Activate Load current state. Tab through title, columns, body, version and confirmation. Listen to labels, field grouping and descriptions.',
  'Use focus mode to edit title and body. Listen to required fields and numeric bounds. Return to browse mode to read nearby help.'],
  'Names, required values, bounds, boolean state and multiline editing are understandable; no important instructions are available only visually.'),
 item('AT-03','Screen reader','Hear validation and success',[
  'Set version to 0 and try saving. Listen to the error and identify the invalid field and linked explanation.',
  'Load valid current state, edit title to Orca sample, confirm and save. Listen through loading and completion.'],
  'You actually hear meaningful error and success feedback, without confusing duplication, and can recover without losing track of focus.'),
 item('AT-04','Screen reader','Understand the dashboard',[
  'Use Dashboard and Refresh dashboard. Listen to the result heading, caption, column headings and record values.',
  'Try Orca table navigation Alt+Shift+arrow keys where a table exists, then Tab away. Return to Editor and this guide.'],
  'The record and its fields are understandable, tables/disclosures can be explored, and you can leave them normally.'),
 item('AT-05','Screen reader','Hear an authorization failure',[
  'Load Workspace, return to the guide and Deny sample writes. Return to the loaded editor, change title, confirm and save.',
  'Listen to the failure and locate Reload Page. Return here, Restore sample writes, reload Workspace and confirm the denied value is absent.'],
  'You actually hear a clear failure and can find recovery. The guide is still usable and denied content is absent.'),
 item('AT-06','Screen reader','Optional fields and reusable arrays',[
  'Open the Notices sign-in link below, sign in with the same sample credentials, then open the Notices Page.',
  'Include sort, Add item, set field to title and direction to asc. Add another item, then Remove item. Invoke the read action. Include offset, set it to 100 and invoke again to hear an empty result.',
  'Open Members, activate its read control and listen to the roster. Return to the guide using Ctrl+PageUp.'],
  'Nested groups, optional inclusion, item names/counts, add/remove focus recovery, empty results and roster headers are understandable. Record each missing behavior.','modules'),
 item('AT-07','Screen reader','Session loss and discovery failure',[
  'Open the BackOffice shell from Sample links and sign-in. Load its actions and leave this tab open. Use Ctrl+L to copy the shell URL if needed.',
  'Open a temporary tab with Ctrl+T and enter the sample Sign in URL shown below. Use its Sign out form. Close this temporary tab with Ctrl+W.',
  'Back in the shell, activate Refresh. Listen to the authentication failure. Return to the guide, then sign in again before further tests.',
  'Natural session expiry is a separate check: leave a signed-in sample untouched for at least one hour, then try Refresh. Record whether this was actually observed; logout does not prove timed expiry.'],
  'Session loss produces an understandable error without replaying an action. Record the actual speech and whether timed expiry was observed. If you cannot wait, record that remaining acceptance work in notes.','shell'),
 item('VIEW-01','Visual and device checks','Zoom, themes and magnification',[
  'In Workspace use Firefox menu > Zoom to reach actual 200%, then 400%. Test Tab, editing and dashboard scrolling. Restore 100%.',
  'Open the BackOffice shell below and try light, dark and system appearance. Use your usual OS high-contrast/magnifier settings only if comfortable, then restore them.'],
  'Controls, text, errors and focus remain readable; content reflows and wide results scroll locally. Record any untested setting as a limitation.','shell'),
 item('TOUCH-01','Visual and device checks','Real touch hardware',[
  'Only if real touch hardware is available: navigate and edit the disposable Workspace, scroll dashboard results, and change orientation.',
  'Otherwise choose Couldn’t Test and note No touch hardware. Do not count mouse or device emulation as touch evidence.'],
  'Targets, scrolling and orientation remain usable on the hardware actually tested.'),
 item('REVIEW-01','Review','Record remaining work',[
  'Use the optional notes for reproducible defects: starting Page, keys pressed, expected result, actual result and whether it repeats.',
  'Describe browser-focus findings, what Orca actually said, environmental blockers, and any assistance you needed. Do not enter personal information.',
  'Save this step, then Export report. Human review is still required; a qualified AT evaluator must assess the evidence before BO-HTTP-12 can be promoted.'],
  'The report reflects your actual observations, failures and incomplete work. No automatic conformance declaration.','guide')
];
export const password='Disposable-B6H-only-2026!';
