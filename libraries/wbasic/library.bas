FUNCTION Mid(value AS String, start AS Integer, count AS Integer) AS String
IF start < 1 OR count < 0 THEN
RETURN Substring(value, start - 1, count)
END IF
IF start > Length(value) THEN
RETURN ""
END IF
RETURN Substring(value, start - 1, Min(count, Length(value) - start + 1))
END FUNCTION
FUNCTION Len(value AS String) AS Integer
RETURN Length(value)
END FUNCTION
FUNCTION InStr(value AS String, search AS String) AS Integer
RETURN IndexOf(value, search) + 1
END FUNCTION
FUNCTION UCase(value AS String) AS String
RETURN ToUpper(value)
END FUNCTION
FUNCTION LCase(value AS String) AS String
RETURN ToLower(value)
END FUNCTION
FUNCTION CStr(value AS Scalar) AS String
RETURN Convert(value, String)
END FUNCTION
FUNCTION Val(value AS Scalar) AS Number
RETURN Convert(value, Number)
END FUNCTION
