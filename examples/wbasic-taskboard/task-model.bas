PUBLIC CLASS TaskModel EXTENDS wydgit.core/block
    META Id = "divdev/task-model"
    CONTENT MARKDOWN ""
    PUBLIC FUNCTION LoadTasks(PageNumber AS Integer) AS Array
        SELECT CASE PageNumber
            CASE 1
                RETURN [{"Key":"alpha","Title":"Write WBasic","Status":"Complete"},{"Key":"beta","Title":"Test canonical artifacts","Status":"Pending"}]
            CASE 2
                RETURN [{"Key":"gamma","Title":"Verify lifecycle cleanup","Status":"Pending"}]
            CASE ELSE
                RETURN []
        END SELECT
    END FUNCTION
END CLASS
